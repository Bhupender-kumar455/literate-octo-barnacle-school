const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { emitChatMessage, emitConversationUpdated } = require('../../services/chatSocket');
const { sendWhatsAppMessage, normalizeWhatsAppPhoneNumber } = require('../../services/whatsappProvider');

const router = express.Router();

const CHAT_MAX_FILE_MB = Number(process.env.CHAT_MAX_FILE_MB || 10);
const CHAT_MAX_FILE_SIZE_BYTES = Number.isFinite(CHAT_MAX_FILE_MB) && CHAT_MAX_FILE_MB > 0
  ? Math.round(CHAT_MAX_FILE_MB * 1024 * 1024)
  : 10 * 1024 * 1024;

const chatUploadDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

let chatSchemaEnsured = false;
const ensureChatSchema = async (pool) => {
  if (chatSchemaEnsured) return;
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'chat_conversations')
    BEGIN
      IF COL_LENGTH('chat_conversations', 'guardian_name') IS NULL
        ALTER TABLE chat_conversations ADD guardian_name NVARCHAR(255) NULL;
      IF COL_LENGTH('chat_conversations', 'guardian_phone') IS NULL
        ALTER TABLE chat_conversations ADD guardian_phone VARCHAR(50) NULL;

      IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'chat_conversations'
          AND COLUMN_NAME = 'parent_user_id'
          AND IS_NULLABLE = 'NO'
      )
        ALTER TABLE chat_conversations ALTER COLUMN parent_user_id BIGINT NULL;
    END
  `);
  chatSchemaEnsured = true;
};

const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.msi', '.ps1']);
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(String(file.originalname || ''));
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
    cb(null, `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: CHAT_MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(String(file.originalname || '').toLowerCase());
    if (blockedExtensions.has(ext)) {
      return cb(new Error('This file type is not allowed'));
    }
    return cb(null, true);
  },
});

const parseId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const clampLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.round(parsed), 1), max);
};

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const normalizePhoneSql = (expression) => (
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(${expression}, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')`
);

const buildPublicBaseUrl = (req) => {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const buildTeacherToGuardianText = ({ conversation, messageText, attachmentUrl }) => {
  const classLabel = [conversation.grade, conversation.section].filter(Boolean).join('-');
  const headerParts = [];
  if (conversation.teacher_name) headerParts.push(`Teacher: ${conversation.teacher_name}`);
  if (conversation.student_name) {
    headerParts.push(classLabel ? `Student: ${conversation.student_name} (${classLabel})` : `Student: ${conversation.student_name}`);
  }

  const body = String(messageText || '').trim();
  const lines = [];
  if (headerParts.length) lines.push(headerParts.join(' | '));
  if (body) lines.push(body);
  if (attachmentUrl) lines.push(`Attachment: ${attachmentUrl}`);
  return lines.join('\n').trim();
};

const relayTeacherMessageToGuardianWhatsApp = async ({ conversation, messageText, attachmentUrl }) => {
  const phone = normalizeWhatsAppPhoneNumber(conversation.parent_phone);
  if (!phone) {
    throw createHttpError(400, 'Guardian WhatsApp number is missing for this student');
  }

  const outboundText = buildTeacherToGuardianText({ conversation, messageText, attachmentUrl });
  if (!outboundText) {
    throw createHttpError(400, 'Message is required');
  }

  try {
    await sendWhatsAppMessage({
      to: phone,
      title: 'Teacher Message',
      message: outboundText,
      metadata: {
        source: 'chat',
        conversation_id: conversation.id,
        student_id: conversation.student_id,
        teacher_id: conversation.teacher_id,
      },
    });
  } catch (err) {
    throw createHttpError(502, `WhatsApp delivery failed: ${err.message}`);
  }
};

const getTeacherIdByUser = async (pool, userId, schoolId) => {
  const teacherResult = await pool.request()
    .input('user_id', sql.BigInt, userId)
    .input('school_id', sql.BigInt, schoolId)
    .query('SELECT id FROM teachers WHERE user_id = @user_id AND school_id = @school_id');
  return teacherResult.recordset[0]?.id || null;
};

const getParentIdByUser = async (pool, userId, schoolId) => {
  const parentResult = await pool.request()
    .input('user_id', sql.BigInt, userId)
    .input('school_id', sql.BigInt, schoolId)
    .query('SELECT id FROM parents WHERE user_id = @user_id AND school_id = @school_id');
  return parentResult.recordset[0]?.id || null;
};

const verifyParentTeacherStudentLink = async (pool, schoolId, parentUserId, teacherId, studentId) => {
  const studentPhone = normalizePhoneSql('s.guardian_phone');
  const parentPhone = normalizePhoneSql("COALESCE(NULLIF(p.phone, ''), NULLIF(pu.phone, ''), '')");
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('parent_user_id', sql.BigInt, parentUserId)
    .input('teacher_id', sql.BigInt, teacherId)
    .input('student_id', sql.BigInt, studentId)
    .query(`
      SELECT TOP 1 s.id
      FROM parents p
      JOIN users pu ON pu.id = p.user_id
      JOIN students s ON s.id = @student_id AND s.school_id = @school_id
      JOIN classes cl ON cl.id = s.class_id
      WHERE p.school_id = @school_id
        AND p.user_id = @parent_user_id
        AND (
          EXISTS (
            SELECT 1
            FROM parent_students ps
            WHERE ps.parent_id = p.id
              AND ps.student_id = s.id
          )
          OR (
            ${studentPhone} <> ''
            AND ${parentPhone} <> ''
            AND ${studentPhone} = ${parentPhone}
          )
        )
        AND (
          cl.class_teacher_id = @teacher_id
          OR EXISTS (
            SELECT 1
            FROM class_subjects cs
            WHERE cs.class_id = s.class_id
              AND cs.teacher_id = @teacher_id
          )
        )
    `);
  return result.recordset.length > 0;
};

const verifyTeacherParentStudentLink = async (pool, schoolId, teacherId, parentUserId, studentId) => {
  const studentPhone = normalizePhoneSql('s.guardian_phone');
  const parentPhone = normalizePhoneSql("COALESCE(NULLIF(p.phone, ''), NULLIF(pu.phone, ''), '')");
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('teacher_id', sql.BigInt, teacherId)
    .input('parent_user_id', sql.BigInt, parentUserId)
    .input('student_id', sql.BigInt, studentId)
    .query(`
      SELECT TOP 1 s.id
      FROM teachers t
      JOIN students s ON s.id = @student_id AND s.school_id = t.school_id
      JOIN classes cl ON cl.id = s.class_id
      JOIN parents p ON p.school_id = t.school_id
      JOIN users pu ON pu.id = p.user_id
      WHERE t.school_id = @school_id
        AND t.id = @teacher_id
        AND p.user_id = @parent_user_id
        AND (
          EXISTS (
            SELECT 1
            FROM parent_students ps
            WHERE ps.parent_id = p.id
              AND ps.student_id = s.id
          )
          OR (
            ${studentPhone} <> ''
            AND ${parentPhone} <> ''
            AND ${studentPhone} = ${parentPhone}
          )
        )
        AND (
          cl.class_teacher_id = @teacher_id
          OR EXISTS (
            SELECT 1
            FROM class_subjects cs
            WHERE cs.class_id = s.class_id
              AND cs.teacher_id = @teacher_id
          )
        )
    `);
  return result.recordset.length > 0;
};

const getTeacherGuardianForStudent = async (pool, schoolId, teacherId, studentId) => {
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('teacher_id', sql.BigInt, teacherId)
    .input('student_id', sql.BigInt, studentId)
    .query(`
      SELECT TOP 1
        s.id AS student_id,
        s.name AS student_name,
        cl.grade,
        cl.section,
        s.guardian_name,
        s.guardian_phone
      FROM students s
      JOIN classes cl ON cl.id = s.class_id
      WHERE s.id = @student_id
        AND s.school_id = @school_id
        AND NULLIF(LTRIM(RTRIM(s.guardian_phone)), '') IS NOT NULL
        AND (
          cl.class_teacher_id = @teacher_id
          OR EXISTS (
            SELECT 1
            FROM class_subjects cs
            WHERE cs.class_id = s.class_id
              AND cs.teacher_id = @teacher_id
          )
        )
    `);
  return result.recordset[0] || null;
};

const getConversationById = async (pool, schoolId, conversationId) => {
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('conversation_id', sql.BigInt, conversationId)
    .query(`
      SELECT
        c.id,
        c.school_id,
        c.parent_user_id,
        c.teacher_id,
        t.user_id AS teacher_user_id,
        c.student_id,
        s.name AS student_name,
        cl.grade,
        cl.section,
        COALESCE(NULLIF(c.guardian_name, ''), pu.name, 'Parent') AS parent_name,
        COALESCE(NULLIF(c.guardian_phone, ''), pu.phone) AS parent_phone,
        tu.name AS teacher_name,
        tu.phone AS teacher_phone,
        c.created_at,
        c.updated_at
      FROM chat_conversations c
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN users pu ON pu.id = c.parent_user_id
      JOIN users tu ON tu.id = t.user_id
      JOIN students s ON s.id = c.student_id
      JOIN classes cl ON cl.id = s.class_id
      WHERE c.school_id = @school_id
        AND c.id = @conversation_id
    `);
  return result.recordset[0] || null;
};

const getConversationSummaryById = async (pool, schoolId, conversationId, viewerUserId) => {
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('conversation_id', sql.BigInt, conversationId)
    .input('viewer_user_id', sql.BigInt, viewerUserId)
    .query(`
      SELECT
        c.id,
        c.school_id,
        c.parent_user_id,
        c.teacher_id,
        t.user_id AS teacher_user_id,
        c.student_id,
        s.name AS student_name,
        cl.grade,
        cl.section,
        COALESCE(NULLIF(c.guardian_name, ''), pu.name, 'Parent') AS parent_name,
        COALESCE(NULLIF(c.guardian_phone, ''), pu.phone) AS parent_phone,
        tu.name AS teacher_name,
        tu.phone AS teacher_phone,
        c.created_at,
        c.updated_at,
        lm.id AS last_message_id,
        lm.message_type AS last_message_type,
        lm.message_text AS last_message_text,
        lm.file_url AS last_message_file_url,
        lm.file_name AS last_message_file_name,
        lm.sender_role AS last_message_sender_role,
        lm.created_at AS last_message_created_at,
        ur.unread_count
      FROM chat_conversations c
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN users pu ON pu.id = c.parent_user_id
      JOIN users tu ON tu.id = t.user_id
      JOIN students s ON s.id = c.student_id
      JOIN classes cl ON cl.id = s.class_id
      OUTER APPLY (
        SELECT TOP 1
          m.id,
          m.message_type,
          m.message_text,
          m.file_url,
          m.file_name,
          m.sender_role,
          m.created_at
        FROM chat_messages m
        WHERE m.conversation_id = c.id
          AND m.deleted_at IS NULL
        ORDER BY m.id DESC
      ) lm
      OUTER APPLY (
        SELECT COUNT(1) AS unread_count
        FROM chat_messages um
        WHERE um.conversation_id = c.id
          AND um.deleted_at IS NULL
          AND um.read_at IS NULL
          AND um.sender_user_id <> @viewer_user_id
      ) ur
      WHERE c.school_id = @school_id
        AND c.id = @conversation_id
    `);
  return result.recordset[0] || null;
};

const assertConversationAccess = async (pool, conversationId, actor) => {
  const conversation = await getConversationById(pool, actor.schoolId, conversationId);
  if (!conversation) {
    throw createHttpError(404, 'Conversation not found');
  }

  if (actor.role === 'parent' && Number(conversation.parent_user_id) !== actor.userId) {
    throw createHttpError(403, 'Not allowed to access this conversation');
  }

  if (actor.role === 'teacher' && Number(conversation.teacher_id) !== actor.teacherId) {
    throw createHttpError(403, 'Not allowed to access this conversation');
  }

  return conversation;
};

const getMessageById = async (pool, messageId) => {
  const result = await pool.request()
    .input('id', sql.BigInt, messageId)
    .query(`
      SELECT
        m.id,
        m.conversation_id,
        m.school_id,
        m.sender_user_id,
        m.sender_role,
        m.message_type,
        m.message_text,
        m.file_url,
        m.file_name,
        m.file_mime_type,
        m.file_size_bytes,
        m.read_at,
        m.created_at,
        u.name AS sender_name
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_user_id
      WHERE m.id = @id
    `);
  return result.recordset[0] || null;
};

const saveChatMessage = async (pool, payload) => {
  const insertResult = await pool.request()
    .input('conversation_id', sql.BigInt, payload.conversationId)
    .input('school_id', sql.BigInt, payload.schoolId)
    .input('sender_user_id', sql.BigInt, payload.senderUserId)
    .input('sender_role', sql.VarChar(20), payload.senderRole)
    .input('message_type', sql.VarChar(20), payload.messageType)
    .input('message_text', sql.NVarChar(sql.MAX), payload.messageText || null)
    .input('file_url', sql.NVarChar(500), payload.fileUrl || null)
    .input('file_name', sql.NVarChar(255), payload.fileName || null)
    .input('file_mime_type', sql.VarChar(255), payload.fileMimeType || null)
    .input('file_size_bytes', sql.BigInt, payload.fileSizeBytes || null)
    .query(`
      INSERT INTO chat_messages
      (conversation_id, school_id, sender_user_id, sender_role, message_type, message_text, file_url, file_name, file_mime_type, file_size_bytes)
      OUTPUT INSERTED.id
      VALUES
      (@conversation_id, @school_id, @sender_user_id, @sender_role, @message_type, @message_text, @file_url, @file_name, @file_mime_type, @file_size_bytes)
    `);

  const messageId = insertResult.recordset[0]?.id || null;
  if (!messageId) throw createHttpError(500, 'Failed to save message');

  await pool.request()
    .input('conversation_id', sql.BigInt, payload.conversationId)
    .query('UPDATE chat_conversations SET updated_at = GETDATE() WHERE id = @conversation_id');

  return getMessageById(pool, messageId);
};

const buildCounterpartyUserId = (conversation, actor) => {
  if (actor.role === 'parent') return Number(conversation.teacher_user_id);
  const parentUserId = Number(conversation.parent_user_id);
  return Number.isFinite(parentUserId) && parentUserId > 0 ? parentUserId : null;
};

router.use(protect, restrictTo('teacher'));

router.use(async (req, res, next) => {
  try {
    const pool = await poolPromise;
    await ensureChatSchema(pool);
    const userId = Number(req.user.id);
    const schoolId = Number(req.user.school_id);
    const role = String(req.user.role || '').toLowerCase();

    if (!Number.isFinite(userId) || !Number.isFinite(schoolId)) {
      return res.status(401).json({ message: 'Invalid auth context' });
    }

    if (role === 'teacher') {
      const teacherId = await getTeacherIdByUser(pool, userId, schoolId);
      if (!teacherId) return res.status(403).json({ message: 'Teacher profile not found' });
      req.chatActor = { userId, schoolId, role, teacherId };
      return next();
    }
    return res.status(403).json({ message: 'Chat access is only available for teacher roles' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/participants', async (req, res) => {
  try {
    const pool = await poolPromise;
    const actor = req.chatActor;

    if (actor.role === 'parent') {
      const studentPhone = normalizePhoneSql('s.guardian_phone');
      const parentPhone = normalizePhoneSql("COALESCE(NULLIF(p.phone, ''), NULLIF(pu.phone, ''), '')");
      const result = await pool.request()
        .input('school_id', sql.BigInt, actor.schoolId)
        .input('user_id', sql.BigInt, actor.userId)
        .query(`
          WITH linked_students AS (
            SELECT DISTINCT
              s.id AS student_id,
              s.name AS student_name,
              s.class_id,
              cl.grade,
              cl.section
            FROM parents p
            JOIN users pu ON pu.id = p.user_id
            JOIN students s ON s.school_id = p.school_id
            JOIN classes cl ON cl.id = s.class_id
            WHERE p.school_id = @school_id
              AND p.user_id = @user_id
              AND (
                EXISTS (
                  SELECT 1
                  FROM parent_students ps
                  WHERE ps.parent_id = p.id
                    AND ps.student_id = s.id
                )
                OR (
                  ${studentPhone} <> ''
                  AND ${parentPhone} <> ''
                  AND ${studentPhone} = ${parentPhone}
                )
              )
          ),
          student_teachers AS (
            SELECT
              ls.student_id,
              ls.student_name,
              ls.grade,
              ls.section,
              t.id AS teacher_id,
              tu.id AS teacher_user_id,
              tu.name AS teacher_name,
              tu.phone AS teacher_phone
            FROM linked_students ls
            JOIN class_subjects cs ON cs.class_id = ls.class_id
            JOIN teachers t ON t.id = cs.teacher_id AND t.school_id = @school_id
            JOIN users tu ON tu.id = t.user_id
            UNION
            SELECT
              ls.student_id,
              ls.student_name,
              ls.grade,
              ls.section,
              t.id AS teacher_id,
              tu.id AS teacher_user_id,
              tu.name AS teacher_name,
              tu.phone AS teacher_phone
            FROM linked_students ls
            JOIN classes cl ON cl.id = ls.class_id
            JOIN teachers t ON t.id = cl.class_teacher_id AND t.school_id = @school_id
            JOIN users tu ON tu.id = t.user_id
          )
          SELECT DISTINCT
            student_id,
            student_name,
            grade,
            section,
            teacher_id,
            teacher_user_id,
            teacher_name,
            teacher_phone
          FROM student_teachers
          ORDER BY student_name, teacher_name
        `);
      return res.json(result.recordset);
    }

    const result = await pool.request()
      .input('school_id', sql.BigInt, actor.schoolId)
      .input('teacher_id', sql.BigInt, actor.teacherId)
      .query(`
        WITH teacher_students AS (
          SELECT DISTINCT
            s.id AS student_id,
            s.name AS student_name,
            s.guardian_name,
            s.guardian_phone,
            cl.grade,
            cl.section
          FROM students s
          JOIN classes cl ON cl.id = s.class_id
          WHERE s.school_id = @school_id
            AND (
              cl.class_teacher_id = @teacher_id
              OR EXISTS (
                SELECT 1
                FROM class_subjects cs
                WHERE cs.class_id = s.class_id
                  AND cs.teacher_id = @teacher_id
              )
            )
        )
        SELECT
          ts.student_id,
          ts.student_name,
          ts.grade,
          ts.section,
          CAST(NULL AS BIGINT) AS parent_user_id,
          COALESCE(NULLIF(ts.guardian_name, ''), 'Parent') AS parent_name,
          ts.guardian_phone AS parent_phone
        FROM teacher_students ts
        WHERE NULLIF(LTRIM(RTRIM(ts.guardian_phone)), '') IS NOT NULL
        ORDER BY ts.student_name
      `);
    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/conversations', async (req, res) => {
  const limit = clampLimit(req.query.limit, 50, 200);

  try {
    const pool = await poolPromise;
    const actor = req.chatActor;

    const request = pool.request()
      .input('school_id', sql.BigInt, actor.schoolId)
      .input('viewer_user_id', sql.BigInt, actor.userId)
      .input('limit', sql.Int, limit);

    let whereClause = '';
    if (actor.role === 'parent') {
      request.input('parent_user_id', sql.BigInt, actor.userId);
      whereClause = 'c.parent_user_id = @parent_user_id';
    } else {
      request.input('teacher_id', sql.BigInt, actor.teacherId);
      whereClause = 'c.teacher_id = @teacher_id';
    }

    const result = await request.query(`
      SELECT TOP (@limit)
        c.id,
        c.school_id,
        c.parent_user_id,
        c.teacher_id,
        t.user_id AS teacher_user_id,
        c.student_id,
        s.name AS student_name,
        cl.grade,
        cl.section,
        COALESCE(NULLIF(c.guardian_name, ''), pu.name, 'Parent') AS parent_name,
        COALESCE(NULLIF(c.guardian_phone, ''), pu.phone) AS parent_phone,
        tu.name AS teacher_name,
        tu.phone AS teacher_phone,
        c.created_at,
        c.updated_at,
        lm.id AS last_message_id,
        lm.message_type AS last_message_type,
        lm.message_text AS last_message_text,
        lm.file_url AS last_message_file_url,
        lm.file_name AS last_message_file_name,
        lm.sender_role AS last_message_sender_role,
        lm.created_at AS last_message_created_at,
        ur.unread_count
      FROM chat_conversations c
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN users pu ON pu.id = c.parent_user_id
      JOIN users tu ON tu.id = t.user_id
      JOIN students s ON s.id = c.student_id
      JOIN classes cl ON cl.id = s.class_id
      OUTER APPLY (
        SELECT TOP 1
          m.id,
          m.message_type,
          m.message_text,
          m.file_url,
          m.file_name,
          m.sender_role,
          m.created_at
        FROM chat_messages m
        WHERE m.conversation_id = c.id
          AND m.deleted_at IS NULL
        ORDER BY m.id DESC
      ) lm
      OUTER APPLY (
        SELECT COUNT(1) AS unread_count
        FROM chat_messages um
        WHERE um.conversation_id = c.id
          AND um.deleted_at IS NULL
          AND um.read_at IS NULL
          AND um.sender_user_id <> @viewer_user_id
      ) ur
      WHERE c.school_id = @school_id
        AND ${whereClause}
      ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC
    `);

    return res.json(result.recordset);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/conversations', async (req, res) => {
  const actor = req.chatActor;
  const studentId = parseId(req.body.student_id);
  if (!studentId) {
    return res.status(400).json({ message: 'student_id is required' });
  }

  try {
    const pool = await poolPromise;
    let parentUserId = null;
    let teacherId = null;
    let guardianName = null;
    let guardianPhone = null;

    if (actor.role === 'parent') {
      teacherId = parseId(req.body.teacher_id);
      if (!teacherId) {
        return res.status(400).json({ message: 'teacher_id is required for parent conversations' });
      }
      parentUserId = actor.userId;

      const allowed = await verifyParentTeacherStudentLink(
        pool,
        actor.schoolId,
        parentUserId,
        teacherId,
        studentId
      );
      if (!allowed) {
        return res.status(403).json({ message: 'You can only chat with teachers who teach your linked student' });
      }
    } else {
      teacherId = actor.teacherId;
      parentUserId = parseId(req.body.parent_user_id);

      if (parentUserId) {
        const allowed = await verifyTeacherParentStudentLink(
          pool,
          actor.schoolId,
          teacherId,
          parentUserId,
          studentId
        );
        if (!allowed) {
          return res.status(403).json({ message: 'You can only chat with parents linked to your student' });
        }
      } else {
        const guardian = await getTeacherGuardianForStudent(
          pool,
          actor.schoolId,
          teacherId,
          studentId
        );
        if (!guardian) {
          return res.status(403).json({
            message: 'You can only chat with guardians of your assigned students that have a guardian phone number'
          });
        }
        guardianName = guardian.guardian_name || null;
        guardianPhone = guardian.guardian_phone || null;
      }
    }

    const existingRequest = pool.request()
      .input('school_id', sql.BigInt, actor.schoolId)
      .input('teacher_id', sql.BigInt, teacherId)
      .input('student_id', sql.BigInt, studentId);

    let existing = null;
    if (parentUserId) {
      existing = await existingRequest
        .input('parent_user_id', sql.BigInt, parentUserId)
        .query(`
          SELECT TOP 1 id
          FROM chat_conversations
          WHERE school_id = @school_id
            AND parent_user_id = @parent_user_id
            AND teacher_id = @teacher_id
            AND student_id = @student_id
        `);
    } else {
      existing = await existingRequest
        .query(`
          SELECT TOP 1 c.id
          FROM chat_conversations c
          WHERE c.school_id = @school_id
            AND c.parent_user_id IS NULL
            AND c.teacher_id = @teacher_id
            AND c.student_id = @student_id
        `);
    }

    let conversationId = existing.recordset[0]?.id || null;
    let created = false;

    if (conversationId && !parentUserId) {
      await pool.request()
        .input('conversation_id', sql.BigInt, conversationId)
        .input('guardian_name', sql.NVarChar(255), guardianName)
        .input('guardian_phone', sql.VarChar(50), guardianPhone)
        .query(`
          UPDATE chat_conversations
          SET guardian_name = @guardian_name,
              guardian_phone = @guardian_phone,
              updated_at = GETDATE()
          WHERE id = @conversation_id
        `);
    }

    if (!conversationId) {
      const inserted = await pool.request()
        .input('school_id', sql.BigInt, actor.schoolId)
        .input('parent_user_id', sql.BigInt, parentUserId)
        .input('teacher_id', sql.BigInt, teacherId)
        .input('student_id', sql.BigInt, studentId)
        .input('guardian_name', sql.NVarChar(255), guardianName)
        .input('guardian_phone', sql.VarChar(50), guardianPhone)
        .input('created_by', sql.BigInt, actor.userId)
        .query(`
          INSERT INTO chat_conversations
          (school_id, parent_user_id, teacher_id, student_id, guardian_name, guardian_phone, created_by)
          OUTPUT INSERTED.id
          VALUES
          (@school_id, @parent_user_id, @teacher_id, @student_id, @guardian_name, @guardian_phone, @created_by)
        `);
      conversationId = inserted.recordset[0]?.id || null;
      created = true;
    }

    if (!conversationId) {
      return res.status(500).json({ message: 'Failed to create conversation' });
    }

    const summary = await getConversationSummaryById(pool, actor.schoolId, conversationId, actor.userId);
    if (!summary) {
      return res.status(500).json({ message: 'Conversation created but failed to fetch details' });
    }

    const recipients = [];
    const teacherUserId = Number(summary.teacher_user_id);
    if (Number.isFinite(teacherUserId) && teacherUserId > 0) recipients.push(teacherUserId);
    const parentConversationUserId = Number(summary.parent_user_id);
    if (Number.isFinite(parentConversationUserId) && parentConversationUserId > 0) {
      recipients.push(parentConversationUserId);
    }

    emitConversationUpdated(recipients, { type: 'conversation_upserted', conversation: summary });

    return res.status(created ? 201 : 200).json({ created, conversation: summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  const limit = clampLimit(req.query.limit, 50, 100);
  const beforeId = req.query.before_id === undefined ? null : parseId(req.query.before_id);
  if (req.query.before_id !== undefined && !beforeId) {
    return res.status(400).json({ message: 'Invalid before_id' });
  }

  try {
    const pool = await poolPromise;
    const actor = req.chatActor;
    await assertConversationAccess(pool, conversationId, actor);

    const messagesResult = await pool.request()
      .input('conversation_id', sql.BigInt, conversationId)
      .input('limit', sql.Int, limit)
      .input('before_id', sql.BigInt, beforeId)
      .query(`
        SELECT TOP (@limit)
          m.id,
          m.conversation_id,
          m.school_id,
          m.sender_user_id,
          m.sender_role,
          m.message_type,
          m.message_text,
          m.file_url,
          m.file_name,
          m.file_mime_type,
          m.file_size_bytes,
          m.read_at,
          m.created_at,
          u.name AS sender_name
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_user_id
        WHERE m.conversation_id = @conversation_id
          AND m.deleted_at IS NULL
          AND (@before_id IS NULL OR m.id < @before_id)
        ORDER BY m.id DESC
      `);

    await pool.request()
      .input('conversation_id', sql.BigInt, conversationId)
      .input('user_id', sql.BigInt, actor.userId)
      .query(`
        UPDATE chat_messages
        SET read_at = GETDATE()
        WHERE conversation_id = @conversation_id
          AND sender_user_id <> @user_id
          AND read_at IS NULL
          AND deleted_at IS NULL
      `);

    const messages = [...messagesResult.recordset].reverse();
    return res.json(messages);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

router.post('/conversations/:id/messages', async (req, res) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  const messageText = String(req.body.message || '').trim();
  if (!messageText) {
    return res.status(400).json({ message: 'message is required' });
  }

  if (messageText.length > 5000) {
    return res.status(400).json({ message: 'message is too long' });
  }

  try {
    const pool = await poolPromise;
    const actor = req.chatActor;
    const conversation = await assertConversationAccess(pool, conversationId, actor);

    if (actor.role === 'teacher') {
      await relayTeacherMessageToGuardianWhatsApp({
        conversation,
        messageText,
        attachmentUrl: null,
      });
    }

    const message = await saveChatMessage(pool, {
      conversationId,
      schoolId: actor.schoolId,
      senderUserId: actor.userId,
      senderRole: actor.role,
      messageType: 'text',
      messageText,
    });

    const counterpartyUserId = buildCounterpartyUserId(conversation, actor);
    emitChatMessage(conversationId, message, [counterpartyUserId]);
    emitConversationUpdated(
      [counterpartyUserId, actor.userId],
      { type: 'conversation_updated', conversation_id: conversationId }
    );

    return res.status(201).json(message);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

const handleAttachmentUpload = (req, res, next) => {
  attachmentUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `File too large. Max ${CHAT_MAX_FILE_MB}MB.` });
    }
    return res.status(400).json({ message: err.message || 'Attachment upload failed' });
  });
};

router.post('/conversations/:id/attachments', handleAttachmentUpload, async (req, res) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'file is required' });
  }

  const caption = String(req.body.caption || '').trim();
  if (caption.length > 5000) {
    return res.status(400).json({ message: 'caption is too long' });
  }

  try {
    const pool = await poolPromise;
    const actor = req.chatActor;
    const conversation = await assertConversationAccess(pool, conversationId, actor);

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    if (actor.role === 'teacher') {
      const absoluteFileUrl = `${buildPublicBaseUrl(req)}${fileUrl}`;
      await relayTeacherMessageToGuardianWhatsApp({
        conversation,
        messageText: caption || `Attachment: ${req.file.originalname || 'File'}`,
        attachmentUrl: absoluteFileUrl,
      });
    }

    const message = await saveChatMessage(pool, {
      conversationId,
      schoolId: actor.schoolId,
      senderUserId: actor.userId,
      senderRole: actor.role,
      messageType: 'file',
      messageText: caption || null,
      fileUrl,
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype || null,
      fileSizeBytes: req.file.size || null,
    });

    const counterpartyUserId = buildCounterpartyUserId(conversation, actor);
    emitChatMessage(conversationId, message, [counterpartyUserId]);
    emitConversationUpdated(
      [counterpartyUserId, actor.userId],
      { type: 'conversation_updated', conversation_id: conversationId }
    );

    return res.status(201).json(message);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

router.put('/conversations/:id/read', async (req, res) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) {
    return res.status(400).json({ message: 'Invalid conversation id' });
  }

  try {
    const pool = await poolPromise;
    const actor = req.chatActor;
    const conversation = await assertConversationAccess(pool, conversationId, actor);

    const result = await pool.request()
      .input('conversation_id', sql.BigInt, conversationId)
      .input('user_id', sql.BigInt, actor.userId)
      .query(`
        UPDATE chat_messages
        SET read_at = GETDATE()
        WHERE conversation_id = @conversation_id
          AND sender_user_id <> @user_id
          AND read_at IS NULL
          AND deleted_at IS NULL
      `);

    const updated = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
    const counterpartyUserId = buildCounterpartyUserId(conversation, actor);
    emitConversationUpdated(
      [counterpartyUserId],
      {
        type: 'messages_read',
        conversation_id: conversationId,
        reader_user_id: actor.userId,
      }
    );

    return res.json({ message: 'Conversation marked as read', updated });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;

