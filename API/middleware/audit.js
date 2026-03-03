const { poolPromise, sql } = require('../config/db');

const audit = (action, entity = null, entityId = null) => {
  return async (req, res, next) => {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('user_id', sql.BigInt, req.user?.id || null)
        .input('role', sql.VarChar(20), req.user?.role || null)
        .input('action', sql.VarChar(50), action)
        .input('entity', sql.VarChar(50), entity)
        .input('entity_id', sql.VarChar(50), entityId ? String(entityId) : null)
        .input('ip_address', sql.VarChar(50), req.ip || null)
        .input('user_agent', sql.NVarChar(255), req.get('user-agent') || null)
        .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify({ path: req.originalUrl, method: req.method }))
        .query(`
          INSERT INTO audit_logs (user_id, role, action, entity, entity_id, ip_address, user_agent, metadata)
          VALUES (@user_id, @role, @action, @entity, @entity_id, @ip_address, @user_agent, @metadata)
        `);
    } catch (err) {
      // Don't block request on audit failure
      console.error('Audit log error:', err.message);
    }
    next();
  };
};

module.exports = { audit };
