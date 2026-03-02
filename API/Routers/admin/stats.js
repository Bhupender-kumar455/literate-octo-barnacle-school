const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const schoolId = req.user.school_id;
    const schoolRes = await pool.request()
      .input('school_id', sql.Int, schoolId)
      .query('SELECT name FROM schools WHERE id = @school_id');

    const studentsRes = await pool.request()
      .input('school_id', sql.Int, schoolId)
      .query('SELECT COUNT(*) AS total_students FROM students WHERE school_id = @school_id');

    const teachersRes = await pool.request()
      .input('school_id', sql.Int, schoolId)
      .query('SELECT COUNT(*) AS total_teachers FROM teachers WHERE school_id = @school_id');

    const attendanceRes = await pool.request()
      .input('school_id', sql.Int, schoolId)
      .query(`
        SELECT 
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
          COUNT(*) AS total_count
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE s.school_id = @school_id
          AND a.[date] = CAST(GETDATE() AS DATE)
      `);

    const feesRes = await pool.request()
      .input('school_id', sql.Int, schoolId)
      .query(`
        SELECT 
          ISNULL(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END), 0) AS pending_fees
        FROM fees_invoices
        WHERE school_id = @school_id
      `);

    const present = attendanceRes.recordset[0]?.present_count || 0;
    const total = attendanceRes.recordset[0]?.total_count || 0;
    const attendanceRate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

    res.json({
      schoolName: schoolRes.recordset[0]?.name || '',
      totalStudents: studentsRes.recordset[0]?.total_students || 0,
      totalTeachers: teachersRes.recordset[0]?.total_teachers || 0,
      attendanceRate,
      pendingFees: feesRes.recordset[0]?.pending_fees || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
