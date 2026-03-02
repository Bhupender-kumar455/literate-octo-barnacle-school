const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
const { poolPromise, sql } = require('../../config/db');
const { getStudentReportCardData, streamReportCardPdf } = require('../../utils/reportCard');

router.use(protect, restrictTo('student'));

const getStudentId = async (pool, userId) => {
  const result = await pool.request()
    .input('user_id', sql.Int, userId)
    .query('SELECT student_id, school_id FROM student_users WHERE user_id = @user_id');
  return result.recordset[0] || null;
};

router.get('/me', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const studentRes = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .input('school_id', sql.Int, mapping.school_id)
      .query(`
        SELECT s.*, c.grade, c.section
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = @student_id AND s.school_id = @school_id
      `);
    if (!studentRes.recordset.length) return res.status(404).json({ message: 'Student not found' });
    res.json(studentRes.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/attendance', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .query(`
        SELECT TOP 30 a.date, a.status, a.remarks, subj.name as subject
        FROM attendance a
        LEFT JOIN class_subjects cs ON a.class_subject_id = cs.id
        LEFT JOIN subjects subj ON cs.subject_id = subj.id
        WHERE a.student_id = @student_id
        ORDER BY a.date DESC, a.id DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fees', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .query(`
        SELECT id, amount, due_date, status, created_at
        FROM fees_invoices
        WHERE student_id = @student_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/grades', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .query(`
        SELECT subject, term, score, max_score, created_at
        FROM grades
        WHERE student_id = @student_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('school_id', sql.Int, mapping.school_id)
      .query(`
        SELECT TOP 20 id, title, message, type, created_at
        FROM announcements
        WHERE school_id = @school_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/notifications', async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 25;

  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('school_id', sql.BigInt, mapping.school_id)
      .input('student_id', sql.BigInt, mapping.student_id)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          id,
          title,
          message,
          status,
          channel,
          created_at,
          sent_at,
          read_at,
          metadata
        FROM notifications
        WHERE school_id = @school_id
          AND channel = 'in_app'
          AND (
            recipient_type = 'school'
            OR (recipient_type = 'student' AND recipient_id = @student_id)
          )
          AND status IN ('queued', 'sent', 'read')
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isFinite(notificationId)) {
    return res.status(400).json({ message: 'Invalid notification id' });
  }

  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('id', sql.BigInt, notificationId)
      .input('school_id', sql.BigInt, mapping.school_id)
      .input('student_id', sql.BigInt, mapping.student_id)
      .query(`
        UPDATE notifications
        SET status = 'read',
            read_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @id
          AND school_id = @school_id
          AND channel = 'in_app'
          AND (
            recipient_type = 'school'
            OR (recipient_type = 'student' AND recipient_id = @student_id)
          )
      `);

    const affected = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
    if (!affected) return res.status(404).json({ message: 'Notification not found' });

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/report-card', async (req, res) => {
  const requestedTerm = req.query.term ? String(req.query.term) : null;
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const reportCard = await getStudentReportCardData(pool, mapping.school_id, mapping.student_id, requestedTerm);
    if (!reportCard) return res.status(404).json({ message: 'Report card not found' });
    res.json(reportCard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/report-card/pdf', async (req, res) => {
  const requestedTerm = req.query.term ? String(req.query.term) : null;
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const reportCard = await getStudentReportCardData(pool, mapping.school_id, mapping.student_id, requestedTerm);
    if (!reportCard) return res.status(404).json({ message: 'Report card not found' });

    streamReportCardPdf(res, reportCard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/schedule', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    // Get the student's class_id
    const studentRes = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .input('school_id', sql.Int, mapping.school_id)
      .query('SELECT class_id FROM students WHERE id = @student_id AND school_id = @school_id');
    if (!studentRes.recordset.length) return res.status(404).json({ message: 'Student not found' });
    const classId = studentRes.recordset[0].class_id;

    const result = await pool.request()
      .input('class_id', sql.Int, classId)
      .query(`
        SELECT
          sch.id,
          sch.day_of_week,
          CONVERT(VARCHAR(5), sch.start_time, 108) AS start_time,
          CONVERT(VARCHAR(5), sch.end_time, 108) AS end_time,
          sch.room,
          subj.name AS subject,
          u.name AS teacher_name
        FROM class_schedule sch
        JOIN class_subjects cs ON sch.class_subject_id = cs.id
        JOIN subjects subj ON cs.subject_id = subj.id
        JOIN teachers t ON cs.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE cs.class_id = @class_id
        ORDER BY
          CASE sch.day_of_week
            WHEN 'Monday'    THEN 1
            WHEN 'Tuesday'   THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday'  THEN 4
            WHEN 'Friday'    THEN 5
            WHEN 'Saturday'  THEN 6
            WHEN 'Sunday'    THEN 7
            ELSE 8
          END,
          sch.start_time
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/assignments', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    // Get the student's class_id
    const studentRes = await pool.request()
      .input('student_id', sql.Int, mapping.student_id)
      .query('SELECT class_id FROM students WHERE id = @student_id');
    if (!studentRes.recordset.length) return res.status(404).json({ message: 'Student not found' });
    const classId = studentRes.recordset[0].class_id;

    // Get all assignments for this student's class, along with their submission status
    const result = await pool.request()
      .input('class_id', sql.Int, classId)
      .input('student_id', sql.Int, mapping.student_id)
      .query(`
        SELECT 
          a.id,
          a.title,
          a.description,
          a.due_date,
          a.max_score,
          s.name as subject_name,
          t_user.name as teacher_name,
          sub.id as submission_id,
          sub.status as submission_status,
          sub.score,
          sub.feedback,
          sub.submitted_at
        FROM assignments a
        JOIN class_subjects cs ON a.class_subject_id = cs.id
        JOIN subjects s ON cs.subject_id = s.id
        JOIN teachers t ON cs.teacher_id = t.id
        JOIN users t_user ON t.user_id = t_user.id
        LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = @student_id
        WHERE cs.class_id = @class_id
        ORDER BY a.due_date DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/assignments/:id/submit', async (req, res) => {
  const { text_content, file_url } = req.body;
  if (!text_content && !file_url) {
    return res.status(400).json({ message: 'Either text_content or file_url must be provided' });
  }

  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    // Ensure the assignment belongs to the student's class
    const validAssignment = await pool.request()
      .input('assignment_id', sql.Int, req.params.id)
      .input('student_id', sql.Int, mapping.student_id)
      .query(`
        SELECT a.id 
        FROM assignments a
        JOIN class_subjects cs ON a.class_subject_id = cs.id
        JOIN students s ON cs.class_id = s.class_id
        WHERE a.id = @assignment_id AND s.id = @student_id
      `);

    if (!validAssignment.recordset.length) {
      return res.status(403).json({ message: 'Not authorized for this assignment' });
    }

    // Check if a submission already exists
    const existingSubmission = await pool.request()
      .input('assignment_id', sql.Int, req.params.id)
      .input('student_id', sql.Int, mapping.student_id)
      .query('SELECT id FROM assignment_submissions WHERE assignment_id = @assignment_id AND student_id = @student_id');

    if (existingSubmission.recordset.length > 0) {
      // Update existing submission
      await pool.request()
        .input('submission_id', sql.Int, existingSubmission.recordset[0].id)
        .input('text_content', sql.NVarChar(sql.MAX), text_content || null)
        .input('file_url', sql.NVarChar(sql.MAX), file_url || null)
        .query(`
                UPDATE assignment_submissions
                SET text_content = @text_content,
                    file_url = @file_url,
                    submitted_at = GETDATE(),
                    status = 'submitted'
                WHERE id = @submission_id
            `);
      return res.json({ message: 'Assignment resubmitted successfully' });
    }

    // Create new submission
    await pool.request()
      .input('assignment_id', sql.Int, req.params.id)
      .input('student_id', sql.Int, mapping.student_id)
      .input('text_content', sql.NVarChar(sql.MAX), text_content || null)
      .input('file_url', sql.NVarChar(sql.MAX), file_url || null)
      .query(`
        INSERT INTO assignment_submissions (assignment_id, student_id, text_content, file_url, status)
        VALUES (@assignment_id, @student_id, @text_content, @file_url, 'submitted')
      `);

    res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/leaves', async (req, res) => {
  try {
    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('user_id', sql.BigInt, req.user.id)
      .query(`
        SELECT id, start_date, end_date, reason, status, comment, created_at, updated_at
        FROM leave_requests
        WHERE school_id = @school_id AND user_id = @user_id AND user_role = 'student'
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching student leaves:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/leaves', async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;
    if (!start_date || !end_date || !reason) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const pool = await poolPromise;
    const mapping = await getStudentId(pool, req.user.id);
    if (!mapping) return res.status(404).json({ message: 'Student mapping not found' });

    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('user_id', sql.BigInt, req.user.id)
      .input('start_date', sql.Date, start_date)
      .input('end_date', sql.Date, end_date)
      .input('reason', sql.NVarChar(sql.MAX), reason)
      .query(`
        INSERT INTO leave_requests (school_id, user_id, user_role, start_date, end_date, reason, status)
        OUTPUT INSERTED.*
        VALUES (@school_id, @user_id, 'student', @start_date, @end_date, @reason, 'pending')
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error submitting student leave:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
