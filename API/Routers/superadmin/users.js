const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('superadmin'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT id, email, role, name, phone, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', audit('update_user', 'user'), async (req, res) => {
  const { id } = req.params;
  const { role, is_active, name, phone } = req.body;

  const normalizedRole = role ? String(role).trim().toLowerCase() : null;
  if (normalizedRole && !['superadmin', 'admin', 'teacher', 'student'].includes(normalizedRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const activeValue = is_active === undefined || is_active === null
    ? null
    : (is_active === true || is_active === 1 || String(is_active).toLowerCase() === 'true') ? 1 : 0;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('role', sql.VarChar(20), normalizedRole)
      .input('is_active', sql.Bit, activeValue)
      .input('name', sql.NVarChar(255), name || null)
      .input('phone', sql.VarChar(15), phone || null)
      .query(`
        UPDATE users
        SET role = COALESCE(@role, role),
            is_active = COALESCE(@is_active, is_active),
            name = COALESCE(@name, name),
            phone = COALESCE(@phone, phone),
            updated_at = GETDATE()
        WHERE id = @id
      `);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
