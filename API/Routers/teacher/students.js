const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('teacher'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const teacherRes = await pool.request()
      .input('user_id', sql.BigInt, req.user.id)
      .query('SELECT id, school_id FROM teachers WHERE user_id = @user_id');
    if (!teacherRes.recordset.length) return res.json([]);
    const teacherId = teacherRes.recordset[0].id;
    const schoolId = teacherRes.recordset[0].school_id;

    // Primary source: students from classes/subjects assigned to this teacher.
    const subjectMapped = await pool.request()
      .input('teacher_id', sql.BigInt, teacherId)
      .query(`
        SELECT DISTINCT 
          s.id,
          s.school_id,
          s.class_id,
          s.admission_no,
          s.roll_number,
          s.name,
          s.gender,
          s.dob,
          s.guardian_name,
          s.guardian_phone,
          c.grade,
          c.section
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        JOIN students s ON s.class_id = c.id
        WHERE cs.teacher_id = @teacher_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
    if (subjectMapped.recordset.length) {
      return res.json(subjectMapped.recordset);
    }

    // Fallback 1: students from classes where teacher is the class teacher.
    const classTeacherMapped = await pool.request()
      .input('teacher_id', sql.BigInt, teacherId)
      .query(`
        SELECT DISTINCT 
          s.id,
          s.school_id,
          s.class_id,
          s.admission_no,
          s.roll_number,
          s.name,
          s.gender,
          s.dob,
          s.guardian_name,
          s.guardian_phone,
          c.grade,
          c.section
        FROM classes c
        JOIN students s ON s.class_id = c.id
        WHERE c.class_teacher_id = @teacher_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
    if (classTeacherMapped.recordset.length) {
      return res.json(classTeacherMapped.recordset);
    }

    // No assignment found for this teacher.
    // Return empty to keep "My Students" consistent with Parent Chat visibility.
    res.json([]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
