const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('teacher'));
router.get('/my-classes-today', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('teacher_id', req.user.id)
            .input('today', new Date().toISOString().split('T')[0])
            .query(`
        SELECT cs.*, c.grade, c.section, s.name as subject_name
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        JOIN subjects s ON cs.subject_id = s.id
        WHERE cs.teacher_id = @teacher_id
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json(err.message); }
});

// Mark attendance
router.post('/mark', async (req, res) => {
    const { student_id, date, status, class_subject_id } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('student_id', student_id)
            .input('date', date)
            .input('status', status)
            .input('class_subject_id', class_subject_id || null)
            .input('marked_by', req.user.id)
            .query(`
        INSERT INTO attendance (student_id, date, status, class_subject_id, marked_by)
        VALUES (@student_id, @date, @status, @class_subject_id, @marked_by)
        ON DUPLICATE KEY UPDATE status = @status
      `);
        res.json({ message: "Attendance marked!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;