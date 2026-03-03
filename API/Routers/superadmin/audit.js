const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('superadmin'));

router.get('/', async (req, res) => {
  const { limit = 100 } = req.query;
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('limit', sql.Int, parsedLimit)
      .query(`
        SELECT TOP (@limit) *
        FROM audit_logs
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
