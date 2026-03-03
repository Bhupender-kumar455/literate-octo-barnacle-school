const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query('SELECT * FROM subjects WHERE school_id = @school_id ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', audit('create_subject', 'subject'), async (req, res) => {
  const { name, code } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Subject name is required' });
  }
  try {
    const pool = await poolPromise;
    const existing = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('name', sql.VarChar(100), name)
      .query('SELECT id FROM subjects WHERE school_id = @school_id AND name = @name');
    if (existing.recordset.length) {
      return res.status(409).json({ message: 'Subject already exists' });
    }

    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('name', sql.VarChar(100), name)
      .input('code', sql.VarChar(20), code || null)
      .query(`
        INSERT INTO subjects (school_id, name, code)
        OUTPUT INSERTED.id
        VALUES (@school_id, @name, @code)
      `);
    res.status(201).json({ id: result.recordset[0].id, message: 'Subject created' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
