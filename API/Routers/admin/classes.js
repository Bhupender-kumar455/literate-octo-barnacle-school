const express = require('express');
const router = express.Router();
const { poolPromise } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('admin'));

// Get all classes for this school
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', req.user.school_id)
            .query(`SELECT * FROM classes WHERE school_id = @school_id ORDER BY grade, section`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new class (e.g., 10-A)
router.post('/', async (req, res) => {
    const { grade, section, academic_year = '2025-2026', class_teacher_id } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', req.user.school_id)
            .input('grade', grade)
            .input('section', section)
            .input('academic_year', academic_year)
            .input('class_teacher_id', class_teacher_id || null)
            .query(`
        INSERT INTO classes (school_id, grade, section, academic_year, class_teacher_id)
        VALUES (@school_id, @grade, @section, @academic_year, @class_teacher_id);
        SELECT SCOPE_IDENTITY() AS id;
      `);
        res.status(201).json({ id: result.recordset[0].id, message: "Class created!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;