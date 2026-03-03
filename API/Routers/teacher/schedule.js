// routes/teacher/schedule.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
const { poolPromise, sql } = require('../../config/db');

router.use(protect, restrictTo('teacher'));

router.get('/today', async (req, res) => {
    try {
      const pool = await poolPromise;
      const teacherRes = await pool.request()
        .input('user_id', sql.Int, req.user.id)
        .query('SELECT id FROM teachers WHERE user_id = @user_id');

      if (!teacherRes.recordset.length) {
        return res.json([]);
      }

      const teacherId = teacherRes.recordset[0].id;

      const result = await pool.request()
        .input('teacher_id', sql.Int, teacherId)
        .query(`
          SELECT cs.*, c.grade, c.section, s.name as subject,
                 CONVERT(VARCHAR(5), sch.start_time, 108) + ' - ' + CONVERT(VARCHAR(5), sch.end_time, 108) as time,
                 sch.room
          FROM class_schedule sch
          JOIN class_subjects cs ON sch.class_subject_id = cs.id
          JOIN classes c ON cs.class_id = c.id
          JOIN subjects s ON cs.subject_id = s.id
          WHERE cs.teacher_id = @teacher_id
            AND LOWER(sch.day_of_week) = LOWER(DATENAME(WEEKDAY, GETDATE()))
          ORDER BY sch.start_time
        `);
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

module.exports = router;
