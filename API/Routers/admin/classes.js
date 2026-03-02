const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

// Get all classes for this school
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('school_id', sql.Int, req.user.school_id)
            .execute('[dbo].[SP_GETCLASSESFORADMIN]');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new class (e.g., 10-A)
router.post('/', audit('create_class', 'class'), async (req, res) => {
    const {
        grade,
        section,
        academic_year = '2025-2026',
        class_teacher_id,
    } = req.body;

    if (!grade || !section) {
        return res.status(400).json({ message: 'Grade and section are required' });
    }

    try {
        const pool = await poolPromise;
        const existing = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('grade', sql.VarChar(50), String(grade))
            .input('section', sql.VarChar(50), String(section))
            .query('SELECT id FROM classes WHERE school_id = @school_id AND grade = @grade AND section = @section');
        if (existing.recordset.length) {
            return res.status(409).json({ message: 'Class already exists' });
        }

        const result = await pool
            .request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('grade', sql.VarChar(50), String(grade))
            .input('section', sql.VarChar(50), String(section))
            .input('year', sql.VarChar(20), academic_year)
            .input('teacher', sql.Int, class_teacher_id || null)
            .execute('[dbo].[SP_CREATECLASS]');

        res.status(201).json({
            id: result.recordset[0].id,
            message: 'Class created'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
