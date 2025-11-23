// routes/teacher/schedule.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
router.use(protect, restrictTo('teacher'));
router.get('/today', async (req, res) => {
    const pool = await poolPromise;
    const today = new Date().toLocaleString('en-US', { weekday: 'long' }).toLowerCase();

    const result = await pool.request()
        .input('teacher_id', req.user.id)
        .query(`
      SELECT cs.*, c.grade, c.section, s.name as subject, 
             '09:00 AM' as time, 'Room 304' as room  -- replace with real timetable later
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.teacher_id = @teacher_id
      ORDER BY time
    `);
    res.json(result.recordset);
});

module.exports = router;