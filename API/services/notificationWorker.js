const nodemailer = require('nodemailer');
const { poolPromise, sql } = require('../config/db');
const { sendWhatsAppMessage } = require('./whatsappProvider');

let intervalHandle = null;
let cycleInProgress = false;
let emailTransporter = null;

const parseIntEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getConfig = () => ({
  enabled: !['false', '0', 'no'].includes(String(process.env.NOTIFICATION_WORKER_ENABLED || 'true').toLowerCase()),
  intervalMs: parseIntEnv(process.env.NOTIFICATION_WORKER_INTERVAL_MS, 30000),
  batchSize: parseIntEnv(process.env.NOTIFICATION_WORKER_BATCH_SIZE, 25),
  maxAttempts: parseIntEnv(process.env.NOTIFICATION_MAX_ATTEMPTS, 5),
  retryBaseMinutes: parseIntEnv(process.env.NOTIFICATION_RETRY_BASE_MINUTES, 2),
  providerTimeoutMs: parseIntEnv(process.env.NOTIFICATION_PROVIDER_TIMEOUT_MS, 15000),
});

const safeParseJson = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const getEmailTransporter = () => {
  if (emailTransporter) return emailTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureEnv = String(process.env.SMTP_SECURE || '').toLowerCase();
  const secure = secureEnv ? ['true', '1', 'yes'].includes(secureEnv) : port === 465;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
  }

  emailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return emailTransporter;
};

const postToProvider = async (url, token, payload, timeoutMs) => {
  if (!url) {
    throw new Error('Provider endpoint not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Provider responded with ${response.status}${body ? `: ${body}` : ''}`);
    }

    const data = await response.json().catch(() => null);
    return data;
  } finally {
    clearTimeout(timeout);
  }
};

const dedupeValues = (values) => {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const resolveRecipients = async (notification) => {
  const pool = await poolPromise;

  if (notification.recipient_type === 'student') {
    const result = await pool.request()
      .input('student_id', sql.BigInt, notification.recipient_id)
      .input('school_id', sql.BigInt, notification.school_id)
      .query(`
        SELECT
          s.guardian_phone,
          su_user.email AS student_email,
          su_user.phone AS student_phone
        FROM students s
        LEFT JOIN student_users su ON su.student_id = s.id
        LEFT JOIN users su_user ON su_user.id = su.user_id
        WHERE s.id = @student_id AND s.school_id = @school_id
      `);
    const row = result.recordset[0] || {};
    return {
      emails: dedupeValues([row.student_email]),
      phones: dedupeValues([row.student_phone, row.guardian_phone]),
    };
  }

  if (notification.recipient_type === 'teacher') {
    if (notification.recipient_id) {
      const result = await pool.request()
        .input('teacher_id', sql.BigInt, notification.recipient_id)
        .input('school_id', sql.BigInt, notification.school_id)
        .query(`
          SELECT u.email, u.phone
          FROM teachers t
          JOIN users u ON u.id = t.user_id
          WHERE t.id = @teacher_id AND t.school_id = @school_id
        `);
      const row = result.recordset[0] || {};
      return {
        emails: dedupeValues([row.email]),
        phones: dedupeValues([row.phone]),
      };
    }

    const result = await pool.request()
      .input('school_id', sql.BigInt, notification.school_id)
      .query(`
        SELECT u.email, u.phone
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        WHERE t.school_id = @school_id
      `);
    return {
      emails: dedupeValues(result.recordset.map((r) => r.email)),
      phones: dedupeValues(result.recordset.map((r) => r.phone)),
    };
  }

  if (notification.recipient_type === 'admin') {
    if (notification.recipient_id) {
      const result = await pool.request()
        .input('user_id', sql.BigInt, notification.recipient_id)
        .query('SELECT email, phone FROM users WHERE id = @user_id');
      const row = result.recordset[0] || {};
      return {
        emails: dedupeValues([row.email]),
        phones: dedupeValues([row.phone]),
      };
    }

    const result = await pool.request()
      .input('school_id', sql.BigInt, notification.school_id)
      .query(`
        SELECT u.email, u.phone
        FROM admins a
        JOIN users u ON u.id = a.user_id
        WHERE a.school_id = @school_id
      `);
    return {
      emails: dedupeValues(result.recordset.map((r) => r.email)),
      phones: dedupeValues(result.recordset.map((r) => r.phone)),
    };
  }

  if (notification.recipient_type === 'school') {
    const result = await pool.request()
      .input('school_id', sql.BigInt, notification.school_id)
      .query(`
        SELECT u.email, u.phone
        FROM admins a
        JOIN users u ON u.id = a.user_id
        WHERE a.school_id = @school_id
      `);
    return {
      emails: dedupeValues(result.recordset.map((r) => r.email)),
      phones: dedupeValues(result.recordset.map((r) => r.phone)),
    };
  }

  return { emails: [], phones: [] };
};

const dispatchNotification = async (notification, recipients, config) => {
  if (notification.channel === 'in_app') {
    return { providerMessageId: null };
  }

  if (notification.channel === 'email') {
    const from = process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER;
    if (!from) {
      throw new Error('Notification email sender not configured. Set NOTIFICATION_EMAIL_FROM or SMTP_USER.');
    }
    if (!recipients.emails.length) {
      throw new Error('No recipient email resolved for notification');
    }
    const transporter = getEmailTransporter();
    const info = await transporter.sendMail({
      from,
      to: recipients.emails.join(','),
      subject: notification.title || 'School Notification',
      text: notification.message,
    });
    return { providerMessageId: info.messageId || null };
  }

  const metadata = safeParseJson(notification.metadata);

  if (notification.channel === 'sms') {
    if (!recipients.phones.length) {
      throw new Error('No recipient phone resolved for SMS notification');
    }
    const endpoint = process.env.SMS_WEBHOOK_URL || '';
    const token = process.env.SMS_WEBHOOK_TOKEN || '';
    for (const phone of recipients.phones) {
      await postToProvider(endpoint, token, {
        channel: 'sms',
        to: phone,
        title: notification.title || null,
        message: notification.message,
        notification_id: notification.id,
        metadata,
      }, config.providerTimeoutMs);
    }
    return { providerMessageId: `sms:${Date.now()}` };
  }

  if (notification.channel === 'whatsapp') {
    if (!recipients.phones.length) {
      throw new Error('No recipient phone resolved for WhatsApp notification');
    }
    const providerMessageIds = [];
    for (const phone of recipients.phones) {
      const providerResult = await sendWhatsAppMessage({
        to: phone,
        title: notification.title || null,
        message: notification.message,
        notificationId: notification.id,
        metadata,
        timeoutMs: config.providerTimeoutMs,
      });

      if (providerResult?.providerMessageId) {
        providerMessageIds.push(String(providerResult.providerMessageId));
      }
    }
    return { providerMessageId: providerMessageIds[0] || `whatsapp:${Date.now()}` };
  }

  throw new Error(`Unsupported notification channel: ${notification.channel}`);
};

const getQueuedNotifications = async (batchSize, maxAttempts) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('batch_size', sql.Int, batchSize)
    .input('max_attempts', sql.Int, maxAttempts)
    .query(`
      SELECT TOP (@batch_size)
        id,
        school_id,
        recipient_type,
        recipient_id,
        channel,
        title,
        message,
        status,
        scheduled_at,
        metadata,
        attempts
      FROM notifications WITH (READPAST)
      WHERE status = 'queued'
        AND attempts < @max_attempts
        AND (scheduled_at IS NULL OR scheduled_at <= GETDATE())
        AND (next_retry_at IS NULL OR next_retry_at <= GETDATE())
      ORDER BY COALESCE(next_retry_at, scheduled_at, created_at), id
    `);
  return result.recordset;
};

const claimNotificationAttempt = async (notificationId, expectedAttempts) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.BigInt, notificationId)
    .input('attempts', sql.Int, expectedAttempts)
    .query(`
      UPDATE notifications
      SET attempts = attempts + 1,
          last_attempt_at = GETDATE(),
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
        AND status = 'queued'
        AND attempts = @attempts
        AND (scheduled_at IS NULL OR scheduled_at <= GETDATE())
        AND (next_retry_at IS NULL OR next_retry_at <= GETDATE())
    `);
  return result.recordset[0] || null;
};

const markNotificationSent = async (id, providerMessageId) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.BigInt, id)
    .input('provider_message_id', sql.NVarChar(255), providerMessageId || null)
    .query(`
      UPDATE notifications
      SET status = 'sent',
          sent_at = GETDATE(),
          provider_message_id = @provider_message_id,
          error_message = NULL,
          next_retry_at = NULL,
          updated_at = GETDATE()
      WHERE id = @id
    `);
};

const markNotificationFailure = async (notification, errorMessage, retryMinutes, finalFailure) => {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.BigInt, notification.id)
    .input('error_message', sql.NVarChar(sql.MAX), errorMessage)
    .input('retry_minutes', sql.Int, retryMinutes)
    .input('status', sql.VarChar(20), finalFailure ? 'failed' : 'queued')
    .query(`
      UPDATE notifications
      SET status = @status,
          error_message = @error_message,
          next_retry_at = CASE WHEN @status = 'queued' THEN DATEADD(MINUTE, @retry_minutes, GETDATE()) ELSE NULL END,
          updated_at = GETDATE()
      WHERE id = @id
    `);
};

const calculateRetryMinutes = (retryBaseMinutes, attempts) => {
  const exponent = Math.max(0, attempts - 1);
  const value = retryBaseMinutes * Math.pow(2, exponent);
  return Math.min(Math.max(Math.round(value), retryBaseMinutes), 24 * 60);
};

const runNotificationDeliveryCycle = async () => {
  if (cycleInProgress) {
    return { skipped: true, reason: 'cycle_in_progress' };
  }

  const config = getConfig();
  if (!config.enabled) {
    return { skipped: true, reason: 'worker_disabled' };
  }

  cycleInProgress = true;
  const summary = {
    skipped: false,
    fetched: 0,
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    errors: [],
  };

  try {
    const queued = await getQueuedNotifications(config.batchSize, config.maxAttempts);
    summary.fetched = queued.length;

    for (const candidate of queued) {
      const claimed = await claimNotificationAttempt(candidate.id, Number(candidate.attempts || 0));
      if (!claimed) continue;
      summary.claimed += 1;

      try {
        const recipients = await resolveRecipients(claimed);
        const result = await dispatchNotification(claimed, recipients, config);
        await markNotificationSent(claimed.id, result.providerMessageId);
        summary.sent += 1;
      } catch (err) {
        const message = err?.message || 'Unknown delivery error';
        const attempts = Number(claimed.attempts || 0);
        const finalFailure = attempts >= config.maxAttempts;
        const retryMinutes = calculateRetryMinutes(config.retryBaseMinutes, attempts);

        await markNotificationFailure(claimed, message, retryMinutes, finalFailure);
        if (finalFailure) {
          summary.failed += 1;
        } else {
          summary.retried += 1;
        }
        summary.errors.push({ id: claimed.id, error: message });
      }
    }

    return summary;
  } finally {
    cycleInProgress = false;
  }
};

const startNotificationWorker = () => {
  const config = getConfig();
  if (!config.enabled) {
    console.log('Notification worker disabled via NOTIFICATION_WORKER_ENABLED');
    return;
  }
  if (intervalHandle) return;

  intervalHandle = setInterval(() => {
    runNotificationDeliveryCycle().catch((err) => {
      console.error('Notification worker cycle error:', err.message);
    });
  }, config.intervalMs);

  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  setTimeout(() => {
    runNotificationDeliveryCycle().catch((err) => {
      console.error('Initial notification delivery error:', err.message);
    });
  }, 1500);

  console.log(`Notification worker started (interval ${config.intervalMs}ms, batch ${config.batchSize})`);
};

const stopNotificationWorker = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};

module.exports = {
  runNotificationDeliveryCycle,
  startNotificationWorker,
  stopNotificationWorker,
};
