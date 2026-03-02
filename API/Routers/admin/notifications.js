const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const { runNotificationDeliveryCycle } = require('../../services/notificationWorker');

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
          entity_type,
          entity_id,
          created_at
        FROM notifications
        WHERE school_id = @school_id
          AND (@status IS NULL OR status = @status)
          AND (@channel IS NULL OR channel = @channel)
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
  const normalizedChannel = normalizeChannel(channel || 'in_app');
  if (!normalizedRecipientType || !normalizedChannel || !message) {
    return res.status(400).json({ message: 'recipient_type, channel, and message are required' });
  }

  const recipientIdNum = recipient_id === undefined || recipient_id === null || recipient_id === ''
    ? null
    : Number(recipient_id);
  if (recipientIdNum !== null && !Number.isFinite(recipientIdNum)) {
    return res.status(400).json({ message: 'Invalid recipient_id' });
  }

  try {
    const pool = await poolPromise;

    if (normalizedRecipientType === 'student' && recipientIdNum !== null) {
      const student = await pool.request()
        .input('student_id', sql.BigInt, recipientIdNum)
        .input('school_id', sql.BigInt, req.user.school_id)
        .query('SELECT id FROM students WHERE id = @student_id AND school_id = @school_id');
      if (!student.recordset.length) {
        return res.status(400).json({ message: 'Invalid student recipient for this school' });
      }
    }

    if (normalizedRecipientType === 'teacher' && recipientIdNum !== null) {
      const teacher = await pool.request()
        .input('teacher_id', sql.BigInt, recipientIdNum)
        .input('school_id', sql.BigInt, req.user.school_id)
        .query('SELECT id FROM teachers WHERE id = @teacher_id AND school_id = @school_id');
      if (!teacher.recordset.length) {
        return res.status(400).json({ message: 'Invalid teacher recipient for this school' });
      }
    }

    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('recipient_type', sql.VarChar(20), normalizedRecipientType)
      .input('recipient_id', sql.BigInt, recipientIdNum)
      .input('channel', sql.VarChar(20), normalizedChannel)
      .input('title', sql.NVarChar(255), title || null)
      .input('message', sql.NVarChar(sql.MAX), String(message))
      .input('scheduled_at', sql.DateTime, scheduled_at || null)
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .input('template_id', sql.BigInt, template_id || null)
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

    res.status(201).json({ id: result.recordset[0].id, message: 'Notification queued' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/trigger/fees-due', audit('queue_fee_due_notifications', 'notification'), async (req, res) => {
  const daysAheadRaw = Number(req.body.days_ahead);
  const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(0, Math.min(daysAheadRaw, 60)) : 3;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .input('days_ahead', sql.Int, daysAhead)
      .input('created_by', sql.BigInt, req.user.id)
      .query(`
        INSERT INTO notifications
        (school_id, recipient_type, recipient_id, channel, title, message, status, metadata, entity_type, entity_id, created_by)
        SELECT
          fi.school_id,
          'student',
          fi.student_id,
          'in_app',
          'Fee Due Reminder',
          CONCAT('Fee invoice #', fi.id, ' of ', CAST(fi.amount AS VARCHAR(50)), ' is due on ', CONVERT(VARCHAR(10), fi.due_date, 120)),
          'queued',
          CONCAT('{"invoice_id":', fi.id, ',"amount":', fi.amount, ',"due_date":"', CONVERT(VARCHAR(10), fi.due_date, 120), '"}'),
          'fees_invoice',
          fi.id,
          @created_by
        FROM fees_invoices fi
        WHERE fi.school_id = @school_id
          AND fi.status IN ('pending', 'overdue')
          AND fi.due_date IS NOT NULL
          AND fi.due_date <= DATEADD(DAY, @days_ahead, CAST(GETDATE() AS DATE))
          AND NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.school_id = fi.school_id
              AND n.entity_type = 'fees_invoice'
              AND n.entity_id = fi.id
              AND CAST(n.created_at AS DATE) = CAST(GETDATE() AS DATE)
          )
      `);

    const queued = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
    res.json({ message: 'Fee reminders queued', queued });
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
