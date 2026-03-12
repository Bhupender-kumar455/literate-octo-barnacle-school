const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { poolPromise, sql } = require('../config/db');

let ioInstance = null;

const parseId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const getSocketToken = (socket) => {
  const fromAuth = String(socket.handshake?.auth?.token || '').trim();
  if (fromAuth) return fromAuth;

  const fromQuery = String(socket.handshake?.query?.token || '').trim();
  if (fromQuery) return fromQuery;

  const authHeader = String(socket.handshake?.headers?.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
};

const getTeacherIdByUser = async (pool, userId, schoolId) => {
  const result = await pool.request()
    .input('user_id', sql.BigInt, userId)
    .input('school_id', sql.BigInt, schoolId)
    .query('SELECT id FROM teachers WHERE user_id = @user_id AND school_id = @school_id');
  return result.recordset[0]?.id || null;
};

const getParentIdByUser = async (pool, userId, schoolId) => {
  const result = await pool.request()
    .input('user_id', sql.BigInt, userId)
    .input('school_id', sql.BigInt, schoolId)
    .query('SELECT id FROM parents WHERE user_id = @user_id AND school_id = @school_id');
  return result.recordset[0]?.id || null;
};

const getConversationForAccess = async (pool, schoolId, conversationId) => {
  const result = await pool.request()
    .input('school_id', sql.BigInt, schoolId)
    .input('conversation_id', sql.BigInt, conversationId)
    .query(`
      SELECT
        c.id,
        c.parent_user_id,
        c.teacher_id,
        t.user_id AS teacher_user_id
      FROM chat_conversations c
      JOIN teachers t ON t.id = c.teacher_id
      WHERE c.school_id = @school_id
        AND c.id = @conversation_id
    `);
  return result.recordset[0] || null;
};

const assertConversationAccess = async (actor, conversationId) => {
  const pool = await poolPromise;
  const conversation = await getConversationForAccess(pool, actor.schoolId, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (actor.role === 'parent' && Number(conversation.parent_user_id) !== actor.userId) {
    throw new Error('Access denied for conversation');
  }
  if (actor.role === 'teacher' && Number(conversation.teacher_id) !== actor.teacherId) {
    throw new Error('Access denied for conversation');
  }

  return conversation;
};

const uniqueNumericIds = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
};

const emitChatMessage = (conversationId, message, userIds = []) => {
  if (!ioInstance) return;
  const room = `conversation:${conversationId}`;
  ioInstance.to(room).emit('chat:message', message);

  for (const userId of uniqueNumericIds(userIds)) {
    ioInstance.to(`user:${userId}`).emit('chat:message', message);
  }
};

const emitConversationUpdated = (userIds = [], payload = {}) => {
  if (!ioInstance) return;
  for (const userId of uniqueNumericIds(userIds)) {
    ioInstance.to(`user:${userId}`).emit('chat:conversation:update', payload);
  }
};

const attachChatSocketServer = (server, { allowedOrigins = [] } = {}) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : true,
      credentials: true,
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) throw new Error('Unauthorized');

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = Number(decoded?.id);
      const schoolId = Number(decoded?.school_id);
      const role = String(decoded?.role || '').toLowerCase();

      if (!Number.isFinite(userId) || !Number.isFinite(schoolId)) {
        throw new Error('Unauthorized');
      }
      if (role !== 'teacher') {
        throw new Error('Socket access only available for teachers');
      }

      const pool = await poolPromise;
      const actor = { userId, schoolId, role };
      if (role === 'teacher') {
        const teacherId = await getTeacherIdByUser(pool, userId, schoolId);
        if (!teacherId) throw new Error('Teacher profile not found');
        actor.teacherId = Number(teacherId);
      }

      socket.data.actor = actor;
      socket.data.joinedConversations = new Set();
      return next();
    } catch (err) {
      return next(new Error(err.message || 'Unauthorized'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const actor = socket.data.actor || null;
    if (!actor) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${actor.userId}`);
    socket.emit('chat:ready', {
      user_id: actor.userId,
      role: actor.role,
      school_id: actor.schoolId,
    });

    socket.on('chat:join', async (payload = {}, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};
      try {
        const conversationId = parseId(payload.conversation_id);
        if (!conversationId) throw new Error('Invalid conversation_id');
        await assertConversationAccess(actor, conversationId);

        socket.join(`conversation:${conversationId}`);
        socket.data.joinedConversations.add(String(conversationId));
        respond({ ok: true, conversation_id: conversationId });
      } catch (err) {
        respond({ ok: false, error: err.message || 'Failed to join conversation' });
      }
    });

    socket.on('chat:leave', (payload = {}, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};
      const conversationId = parseId(payload.conversation_id);
      if (!conversationId) {
        respond({ ok: false, error: 'Invalid conversation_id' });
        return;
      }

      socket.leave(`conversation:${conversationId}`);
      socket.data.joinedConversations.delete(String(conversationId));
      respond({ ok: true, conversation_id: conversationId });
    });

    socket.on('chat:typing', (payload = {}) => {
      const conversationId = parseId(payload.conversation_id);
      if (!conversationId) return;

      const key = String(conversationId);
      if (!socket.data.joinedConversations.has(key)) return;

      socket.to(`conversation:${conversationId}`).emit('chat:typing', {
        conversation_id: conversationId,
        user_id: actor.userId,
        role: actor.role,
        is_typing: Boolean(payload.is_typing),
        at: new Date().toISOString(),
      });
    });
  });

  return ioInstance;
};

const getChatIo = () => ioInstance;

module.exports = {
  attachChatSocketServer,
  emitChatMessage,
  emitConversationUpdated,
  getChatIo,
};

