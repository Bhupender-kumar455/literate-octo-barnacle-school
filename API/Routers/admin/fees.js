// routes/admin/fees.js
const express = require('express');
const router = express.Router();
router.get('/stats', async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('school_id', req.user.school_id)
    .query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending
      FROM fees_invoices WHERE school_id = @school_id
    `);
  res.json(result.recordset[0]);
});

router.post('/invoices', async (req, res) => {
  const { student_id, amount, due_date } = req.body;
  const pool = await poolPromise;
  await pool.request()
    .input('school_id', req.user.school_id)
    .input('student_id', student_id)
    .input('amount', amount)
    .input('due_date', due_date)
    .query(`INSERT INTO fees_invoices (school_id, student_id, amount, due_date, status) 
            VALUES (@school_id, @student_id, @amount, @due_date, 'pending')`);
  res.status(201).json({ message: "Invoice generated!" });
});

module.exports = router;