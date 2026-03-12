const { poolPromise, sql } = require('../config/db');

const ALLOWED_CHANNELS = new Set(['in_app', 'email', 'sms', 'whatsapp']);
const ALLOWED_RECIPIENT_TYPES = new Set(['school', 'student', 'teacher', 'admin']);

const EVENT_CHANNEL_ENV_MAP = {
  fee_reminder: 'NOTIFICATION_CHANNELS_FEE_REMINDER',
  attendance_alert: 'NOTIFICATION_CHANNELS_ATTENDANCE',
  result_alert: 'NOTIFICATION_CHANNELS_RESULTS',
  leave_approval: 'NOTIFICATION_CHANNELS_LEAVE',
};

const parseChannels = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry && ALLOWED_CHANNELS.has(entry));

const unique = (values) => {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const normalizeChannels = (channels) => {
  if (channels === undefined || channels === null) return [];
  const input = Array.isArray(channels) ? channels : [channels];
  return unique(
    input
      .map((value) => String(value || '').trim().toLowerCase())
      .filter((value) => value && ALLOWED_CHANNELS.has(value))
  );
};

const resolveEventChannels = (eventKey, fallbackChannels = ['in_app']) => {
  const normalizedEventKey = String(eventKey || '').trim().toLowerCase();
  const specificEnvKey = EVENT_CHANNEL_ENV_MAP[normalizedEventKey] || null;
  const fromSpecific = specificEnvKey ? parseChannels(process.env[specificEnvKey]) : [];
  const fromDefault = parseChannels(process.env.NOTIFICATION_CHANNELS_DEFAULT || '');
  const fromFallback = normalizeChannels(fallbackChannels);

  const resolved = fromSpecific.length
    ? fromSpecific
    : (fromDefault.length ? fromDefault : fromFallback);

  return resolved.length ? resolved : ['in_app'];
};

const normalizeRecipientType = (recipientType) => {
  const value = String(recipientType || '').trim().toLowerCase();
  return ALLOWED_RECIPIENT_TYPES.has(value) ? value : null;
};

const toBigIntOrNull = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
};

const toMetadataString = (metadata) => {
  if (metadata === undefined || metadata === null || metadata === '') return null;
  if (typeof metadata === 'string') {
    const trimmed = metadata.trim();
    return trimmed || null;
  }
  return JSON.stringify(metadata);
};

const normalizeDedupe = (dedupe, hasEntity) => {
  if (!dedupe) {
    return {
      enabled: false,
      perDay: false,
      byEntity: false,
      byTitle: false,
      byMessage: false,
    };
  }

  const source = dedupe === true ? { byEntity: true } : dedupe;
  const perDay = source.perDay !== false;
  const byEntity = hasEntity ? !!source.byEntity : false;
  const byTitle = !!source.byTitle;
  const byMessage = !!source.byMessage;

  return {
    enabled: perDay || byEntity || byTitle || byMessage,
    perDay,
    byEntity,
    byTitle,
    byMessage,
  };
};

const queueNotification = async ({
  schoolId,
  recipientType = 'school',
  recipientId = null,
  channels = ['in_app'],
  title = null,
  message,
  scheduledAt = null,
  metadata = null,
  templateId = null,
  entityType = null,
  entityId = null,
  createdBy = null,
  dedupe = null,
}) => {
  const schoolIdNum = Number(schoolId);
  if (!Number.isFinite(schoolIdNum) || schoolIdNum <= 0) {
    throw new Error('Invalid schoolId');
  }

  const normalizedRecipientType = normalizeRecipientType(recipientType);
  if (!normalizedRecipientType) {
    throw new Error('Invalid recipientType');
  }

  const recipientIdNum = toBigIntOrNull(recipientId, 'recipientId');
  if (normalizedRecipientType === 'student' && recipientIdNum === null) {
    throw new Error('recipientId is required for student notifications');
  }

  const templateIdNum = toBigIntOrNull(templateId, 'templateId');
  const entityIdNum = toBigIntOrNull(entityId, 'entityId');
  const createdByNum = toBigIntOrNull(createdBy, 'createdBy');
  const normalizedChannels = normalizeChannels(channels);
  if (!normalizedChannels.length) {
    throw new Error('At least one valid channel is required');
  }

  const finalMessage = String(message || '').trim();
  if (!finalMessage) {
    throw new Error('message is required');
  }

  const metadataString = toMetadataString(metadata);
  const hasEntity = !!(entityType || entityIdNum !== null);
  const dedupeConfig = normalizeDedupe(dedupe, hasEntity);

  const pool = await poolPromise;
  const queuedIds = [];
  const skipped = [];

  for (const channel of normalizedChannels) {
    if (dedupeConfig.enabled) {
      const duplicateCheck = await pool.request()
        .input('school_id', sql.BigInt, schoolIdNum)
        .input('recipient_type', sql.VarChar(20), normalizedRecipientType)
        .input('recipient_id', sql.BigInt, recipientIdNum)
        .input('channel', sql.VarChar(20), channel)
        .input('title', sql.NVarChar(255), title || null)
        .input('message', sql.NVarChar(sql.MAX), finalMessage)
        .input('entity_type', sql.VarChar(50), entityType || null)
        .input('entity_id', sql.BigInt, entityIdNum)
        .input('dedupe_per_day', sql.Bit, dedupeConfig.perDay ? 1 : 0)
        .input('dedupe_by_entity', sql.Bit, dedupeConfig.byEntity ? 1 : 0)
        .input('dedupe_by_title', sql.Bit, dedupeConfig.byTitle ? 1 : 0)
        .input('dedupe_by_message', sql.Bit, dedupeConfig.byMessage ? 1 : 0)
        .query(`
          SELECT TOP 1 id
          FROM notifications n
          WHERE n.school_id = @school_id
            AND n.recipient_type = @recipient_type
            AND ((n.recipient_id IS NULL AND @recipient_id IS NULL) OR n.recipient_id = @recipient_id)
            AND n.channel = @channel
            AND n.status IN ('queued', 'sent', 'read')
            AND (@dedupe_per_day = 0 OR CAST(n.created_at AS DATE) = CAST(GETDATE() AS DATE))
            AND (
              @dedupe_by_entity = 0
              OR (
                ISNULL(n.entity_type, '') = ISNULL(@entity_type, '')
                AND ((n.entity_id IS NULL AND @entity_id IS NULL) OR n.entity_id = @entity_id)
              )
            )
            AND (@dedupe_by_title = 0 OR ISNULL(n.title, '') = ISNULL(@title, ''))
            AND (@dedupe_by_message = 0 OR n.message = @message)
          ORDER BY n.id DESC
        `);

      const duplicateId = duplicateCheck.recordset[0]?.id || null;
      if (duplicateId) {
        skipped.push({ channel, reason: 'duplicate', notificationId: duplicateId });
        continue;
      }
    }

    const insertResult = await pool.request()
      .input('school_id', sql.BigInt, schoolIdNum)
      .input('recipient_type', sql.VarChar(20), normalizedRecipientType)
      .input('recipient_id', sql.BigInt, recipientIdNum)
      .input('channel', sql.VarChar(20), channel)
      .input('title', sql.NVarChar(255), title || null)
      .input('message', sql.NVarChar(sql.MAX), finalMessage)
      .input('scheduled_at', sql.DateTime, scheduledAt || null)
      .input('metadata', sql.NVarChar(sql.MAX), metadataString)
      .input('template_id', sql.BigInt, templateIdNum)
      .input('entity_type', sql.VarChar(50), entityType || null)
      .input('entity_id', sql.BigInt, entityIdNum)
      .input('created_by', sql.BigInt, createdByNum)
      .query(`
        INSERT INTO notifications
        (school_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, metadata, template_id, entity_type, entity_id, created_by)
        OUTPUT INSERTED.id
        VALUES
        (@school_id, @recipient_type, @recipient_id, @channel, @title, @message, 'queued', @scheduled_at, @metadata, @template_id, @entity_type, @entity_id, @created_by)
      `);

    const notificationId = insertResult.recordset[0]?.id || null;
    if (notificationId !== null) {
      queuedIds.push(notificationId);
    }
  }

  return {
    queuedIds,
    skipped,
    channels: normalizedChannels,
  };
};

const queueNotificationForEvent = async ({
  eventKey,
  fallbackChannels = ['in_app', 'whatsapp'],
  ...notification
}) => queueNotification({
  ...notification,
  channels: resolveEventChannels(eventKey, fallbackChannels),
});

module.exports = {
  queueNotification,
  queueNotificationForEvent,
  resolveEventChannels,
  normalizeChannels,
};
