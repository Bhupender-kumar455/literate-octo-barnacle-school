const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('superadmin'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;

    const schoolsRes = await pool.request()
      .query('SELECT COUNT(*) AS total_schools FROM schools');

    const studentsRes = await pool.request()
      .query('SELECT COUNT(*) AS total_students FROM students');

    const revenueRes = await pool.request()
      .query(`
        SELECT ISNULL(SUM(amount), 0) AS total_revenue
        FROM fees_invoices
        WHERE status = 'paid'
          AND MONTH(created_at) = MONTH(GETDATE())
          AND YEAR(created_at) = YEAR(GETDATE())
      `);

    const activeRes = await pool.request()
      .query(`
        SELECT COUNT(DISTINCT student_id) AS active_today
        FROM attendance
        WHERE [date] = CAST(GETDATE() AS DATE)
          AND status = 'present'
      `);

    res.json({
      totalSchools: schoolsRes.recordset[0]?.total_schools || 0,
      totalStudents: studentsRes.recordset[0]?.total_students || 0,
      totalRevenue: revenueRes.recordset[0]?.total_revenue || 0,
      activeToday: activeRes.recordset[0]?.active_today || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
