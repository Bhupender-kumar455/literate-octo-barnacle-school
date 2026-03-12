const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const { runNotificationDeliveryCycle } = require('../../services/notificationWorker');
const { queueNotificationForEvent, resolveEventChannels } = require('../../services/notificationQueue');

router.use(protect, restrictTo('admin'));

const normalizeChannel = (channel) => {
  const value = String(channel || '').toLowerCase();
  return ['in_app', 'email', 'sms', 'whatsapp'].includes(value) ? value : null;
};

const normalizeStatus = (status) => {
  const value = String(status || '').toLowerCase();
  return ['queued', 'sent', 'failed', 'cancelled', 'read'].includes(value) ? value : null;
};

const normalizeRecipientType = (recipientType) => {
  const value = String(recipientType || '').toLowerCase();
  return ['school', 'student', 'teacher', 'admin'].includes(value) ? value : null;
};

const parseMetadataInput = (input) => {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('metadata must be a JSON object');
    }
    return parsed;
  }
  throw new Error('metadata must be a JSON object');
};

const renderTemplateText = (template, variables) =>
  String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    if (!variables || !Object.prototype.hasOwnProperty.call(variables, key)) {
      return '';
    }
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });

router.get('/templates', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .query(`
        SELECT id, name, channel, title_template, message_template, is_active, created_at
        FROM notification_templates
        WHERE school_id = @school_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/templates', audit('create_notification_template', 'notification_template'), async (req, res) => {
  const { name, channel, title_template, message_template, is_active } = req.body;
  const normalizedChannel = normalizeChannel(channel);
  if (!name || !normalizedChannel || !message_template) {
    return res.status(400).json({ message: 'name, valid channel, and message_template are required' });
  }

  try {
    const pool = await poolPromise;
    const existing = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('name', sql.NVarChar(100), String(name).trim())
      .query('SELECT id FROM notification_templates WHERE school_id = @school_id AND name = @name');
    if (existing.recordset.length) {
      return res.status(409).json({ message: 'Template name already exists' });
    }

    await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('name', sql.NVarChar(100), String(name).trim())
      .input('channel', sql.VarChar(20), normalizedChannel)
      .input('title_template', sql.NVarChar(255), title_template || null)
      .input('message_template', sql.NVarChar(sql.MAX), String(message_template))
      .input('is_active', sql.Bit, is_active === undefined ? 1 : (is_active ? 1 : 0))
      .input('created_by', sql.BigInt, req.user.id)
      .query(`
        INSERT INTO notification_templates
        (school_id, name, channel, title_template, message_template, is_active, created_by)
        VALUES
        (@school_id, @name, @channel, @title_template, @message_template, @is_active, @created_by)
      `);

    res.status(201).json({ message: 'Template created' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  const status = req.query.status ? normalizeStatus(req.query.status) : null;
  const channel = req.query.channel ? normalizeChannel(req.query.channel) : null;
  const includeFuture = String(req.query.include_future || '').toLowerCase() === 'true';
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  if (req.query.status && !status) {
    return res.status(400).json({ message: 'Invalid status filter' });
  }
  if (req.query.channel && !channel) {
    return res.status(400).json({ message: 'Invalid channel filter' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('status', sql.VarChar(20), status)
      .input('channel', sql.VarChar(20), channel)
      .input('include_future', sql.Bit, includeFuture ? 1 : 0)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          id,
          recipient_type,
          recipient_id,
          channel,
          title,
          message,
          status,
          scheduled_at,
          sent_at,
          read_at,
          attempts,
          last_attempt_at,
          next_retry_at,
          provider_message_id,
          error_message,
          metadata,
          template_id,
          entity_type,
          entity_id,
          updated_at,
          created_at
        FROM notifications
        WHERE school_id = @school_id
          AND (@status IS NULL OR status = @status)
          AND (@channel IS NULL OR channel = @channel)
          AND (@include_future = 1 OR scheduled_at IS NULL OR scheduled_at <= GETDATE())
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', audit('queue_notification', 'notification'), async (req, res) => {
  const {
    recipient_type,
    recipient_id,
    recipient_ids,
    channel,
    title,
    message,
    scheduled_at,
    metadata,
    template_id,
    entity_type,
    entity_id,
  } = req.body;

  const normalizedRecipientType = normalizeRecipientType(recipient_type || 'school');
  if (!normalizedRecipientType) {
    return res.status(400).json({ message: 'recipient_type must be one of school, student, teacher, admin' });
  }

  const recipientIdNum = recipient_id === undefined || recipient_id === null || recipient_id === ''
    ? null
    : Number(recipient_id);
  if (recipientIdNum !== null && !Number.isFinite(recipientIdNum)) {
    return res.status(400).json({ message: 'Invalid recipient_id' });
  }

  const recipientIdsRaw = Array.isArray(recipient_ids)
    ? recipient_ids
    : (recipient_ids === undefined || recipient_ids === null || recipient_ids === '' ? [] : [recipient_ids]);
  const parsedRecipientIds = recipientIdsRaw.map((value) => Number(value));
  if (parsedRecipientIds.some((value) => !Number.isFinite(value))) {
    return res.status(400).json({ message: 'Invalid recipient_ids' });
  }
  const recipientIdsNum = [...new Set(parsedRecipientIds)];

  if (normalizedRecipientType === 'student' && recipientIdNum === null) {
    return res.status(400).json({ message: 'recipient_id is required for student notifications' });
  }
  if (normalizedRecipientType !== 'teacher' && recipientIdsNum.length) {
    return res.status(400).json({ message: 'recipient_ids is only supported for teacher notifications' });
  }

  const templateIdNum = template_id === undefined || template_id === null || template_id === ''
    ? null
    : Number(template_id);
  if (templateIdNum !== null && !Number.isFinite(templateIdNum)) {
    return res.status(400).json({ message: 'Invalid template_id' });
  }

  let metadataObj = null;
  try {
    metadataObj = parseMetadataInput(metadata);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  try {
    const pool = await poolPromise;
    let template = null;
    if (templateIdNum !== null) {
      const templateResult = await pool.request()
        .input('id', sql.BigInt, templateIdNum)
        .input('school_id', sql.BigInt, req.user.school_id)
        .query(`
          SELECT id, channel, title_template, message_template, is_active
          FROM notification_templates
          WHERE id = @id AND school_id = @school_id
        `);
      if (!templateResult.recordset.length) {
        return res.status(400).json({ message: 'Template not found for this school' });
      }
      template = templateResult.recordset[0];
      if (!template.is_active) {
        return res.status(400).json({ message: 'Template is inactive' });
      }
    }

    const normalizedChannel = normalizeChannel(channel || template?.channel || 'in_app');
    if (!normalizedChannel) {
      return res.status(400).json({ message: 'Invalid channel' });
    }
    if (template && channel && normalizeChannel(channel) !== template.channel) {
      return res.status(400).json({ message: 'channel must match selected template channel' });
    }

    const renderedTitle = template
      ? renderTemplateText(template.title_template, metadataObj || {})
      : null;
    const renderedMessage = template
      ? renderTemplateText(template.message_template, metadataObj || {})
      : '';

    const finalTitle = title || renderedTitle || null;
    const finalMessage = message || renderedMessage;
    if (!finalMessage || !String(finalMessage).trim()) {
      return res.status(400).json({ message: 'message is required (or provide template_id with a valid message_template)' });
    }

    if (normalizedRecipientType === 'student' && recipientIdNum !== null) {
      const student = await pool.request()
        .input('student_id', sql.BigInt, recipientIdNum)
        .input('school_id', sql.BigInt, req.user.school_id)
        .query('SELECT id FROM students WHERE id = @student_id AND school_id = @school_id');
      if (!student.recordset.length) {
        return res.status(400).json({ message: 'Invalid student recipient for this school' });
      }
    }

    let teacherTargetIds = [];
    if (normalizedRecipientType === 'teacher') {
      teacherTargetIds = recipientIdsNum.length
        ? recipientIdsNum
        : (recipientIdNum !== null ? [recipientIdNum] : []);

      if (teacherTargetIds.length) {
        const teacherRequest = pool.request()
          .input('school_id', sql.BigInt, req.user.school_id);
        const placeholders = teacherTargetIds.map((_, idx) => {
          const key = `teacher_id_${idx}`;
          teacherRequest.input(key, sql.BigInt, teacherTargetIds[idx]);
          return `@${key}`;
        });

        const teacherResult = await teacherRequest.query(`
          SELECT id
          FROM teachers
          WHERE school_id = @school_id
            AND id IN (${placeholders.join(', ')})
        `);

        const found = new Set(teacherResult.recordset.map((row) => Number(row.id)));
        const missing = teacherTargetIds.filter((id) => !found.has(Number(id)));
        if (missing.length) {
          return res.status(400).json({ message: `Invalid teacher recipient(s) for this school: ${missing.join(', ')}` });
        }
      } else {
        const teacherCount = await pool.request()
          .input('school_id', sql.BigInt, req.user.school_id)
          .query('SELECT COUNT(1) AS total FROM teachers WHERE school_id = @school_id');
        const totalTeachers = Number(teacherCount.recordset[0]?.total || 0);
        if (!totalTeachers) {
          return res.status(400).json({ message: 'No teachers found in this school' });
        }
      }
    }

    if (normalizedRecipientType === 'admin' && recipientIdNum !== null) {
      const admin = await pool.request()
        .input('user_id', sql.BigInt, recipientIdNum)
        .input('school_id', sql.BigInt, req.user.school_id)
        .query(`
          SELECT u.id
          FROM admins a
          JOIN users u ON u.id = a.user_id
          WHERE u.id = @user_id AND a.school_id = @school_id
        `);
      if (!admin.recordset.length) {
        return res.status(400).json({ message: 'Invalid admin recipient for this school' });
      }
    }

    const insertNotification = async (targetRecipientId) => {
      const insertResult = await pool.request()
        .input('school_id', sql.BigInt, req.user.school_id)
        .input('recipient_type', sql.VarChar(20), normalizedRecipientType)
        .input('recipient_id', sql.BigInt, targetRecipientId)
        .input('channel', sql.VarChar(20), normalizedChannel)
        .input('title', sql.NVarChar(255), finalTitle)
        .input('message', sql.NVarChar(sql.MAX), String(finalMessage))
        .input('scheduled_at', sql.DateTime, scheduled_at || null)
        .input('metadata', sql.NVarChar(sql.MAX), metadataObj ? JSON.stringify(metadataObj) : null)
        .input('template_id', sql.BigInt, templateIdNum)
        .input('entity_type', sql.VarChar(50), entity_type || null)
        .input('entity_id', sql.BigInt, entity_id || null)
        .input('created_by', sql.BigInt, req.user.id)
        .query(`
          INSERT INTO notifications
          (school_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, metadata, template_id, entity_type, entity_id, created_by)
          OUTPUT INSERTED.id
          VALUES
          (@school_id, @recipient_type, @recipient_id, @channel, @title, @message, 'queued', @scheduled_at, @metadata, @template_id, @entity_type, @entity_id, @created_by)
        `);
      return insertResult.recordset[0]?.id || null;
    };

    const queuedIds = [];
    if (normalizedRecipientType === 'teacher') {
      if (teacherTargetIds.length) {
        for (const teacherId of teacherTargetIds) {
          const id = await insertNotification(teacherId);
          if (id !== null) queuedIds.push(id);
        }
      } else {
        const id = await insertNotification(null);
        if (id !== null) queuedIds.push(id);
      }
    } else {
      const id = await insertNotification(recipientIdNum);
      if (id !== null) queuedIds.push(id);
    }

    if (!queuedIds.length) {
      return res.status(500).json({ message: 'Failed to queue notification' });
    }

    if (queuedIds.length === 1) {
      return res.status(201).json({ id: queuedIds[0], queued: 1, message: 'Notification queued' });
    }

    res.status(201).json({ ids: queuedIds, queued: queuedIds.length, message: 'Notifications queued' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/trigger/fees-due', audit('queue_fee_due_notifications', 'notification'), async (req, res) => {
  const daysAheadRaw = Number(req.body.days_ahead);
  const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(0, Math.min(daysAheadRaw, 60)) : 3;

  try {
    const pool = await poolPromise;
    const dueInvoicesResult = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('days_ahead', sql.Int, daysAhead)
      .query(`
        SELECT
          fi.id,
          fi.student_id,
          fi.amount,
          fi.due_date,
          fi.status
        FROM fees_invoices fi
        WHERE fi.school_id = @school_id
          AND fi.status IN ('pending', 'overdue')
          AND fi.due_date IS NOT NULL
          AND fi.due_date <= DATEADD(DAY, @days_ahead, CAST(GETDATE() AS DATE))
      `);

    const eventChannels = resolveEventChannels('fee_reminder', ['in_app', 'whatsapp']);
    let queued = 0;
    let skipped = 0;

    for (const invoice of dueInvoicesResult.recordset) {
      const dueDateText = invoice.due_date
        ? new Date(invoice.due_date).toISOString().slice(0, 10)
        : 'N/A';
      const queueResult = await queueNotificationForEvent({
        eventKey: 'fee_reminder',
        fallbackChannels: ['in_app', 'whatsapp'],
        schoolId: req.user.school_id,
        recipientType: 'student',
        recipientId: invoice.student_id,
        title: 'Fee Due Reminder',
        message: `Fee invoice #${invoice.id} of ${invoice.amount} is due on ${dueDateText}.`,
        metadata: {
          alert_type: 'fee_due',
          invoice_id: Number(invoice.id),
          amount: Number(invoice.amount),
          due_date: dueDateText,
          status: String(invoice.status || '').toLowerCase(),
        },
        entityType: 'fees_invoice',
        entityId: invoice.id,
        createdBy: req.user.id,
        dedupe: {
          perDay: true,
          byEntity: true,
          byTitle: true,
        },
      });

      queued += queueResult.queuedIds.length;
      skipped += queueResult.skipped.length;
    }

    res.json({
      message: 'Fee reminders queued',
      invoices_considered: dueInvoicesResult.recordset.length,
      channels: eventChannels,
      queued,
      skipped,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', audit('update_notification_status', 'notification'), async (req, res) => {
  const notificationId = Number(req.params.id);
  const status = normalizeStatus(req.body.status);
  if (!Number.isFinite(notificationId) || !status) {
    return res.status(400).json({ message: 'Valid notification id and status are required' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.BigInt, notificationId)
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('status', sql.VarChar(20), status)
      .input('error_message', sql.NVarChar(sql.MAX), req.body.error_message || null)
      .query(`
        UPDATE notifications
        SET status = @status,
            sent_at = CASE WHEN @status = 'sent' THEN GETDATE() ELSE sent_at END,
            read_at = CASE
              WHEN @status = 'read' THEN GETDATE()
              WHEN @status IN ('queued','sent','failed','cancelled') THEN NULL
              ELSE read_at
            END,
            error_message = CASE WHEN @status = 'failed' THEN @error_message ELSE error_message END,
            next_retry_at = CASE WHEN @status IN ('sent','failed','cancelled','read') THEN NULL ELSE next_retry_at END,
            updated_at = GETDATE()
        WHERE id = @id AND school_id = @school_id
      `);

    const affected = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
    if (!affected) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification status updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/dispatch/run-now', audit('dispatch_notifications', 'notification'), async (req, res) => {
  try {
    const summary = await runNotificationDeliveryCycle();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
