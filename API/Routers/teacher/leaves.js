const express = require('express');
const router = express.Router();
const { poolPromise } = require('../../config/db');
const { protect } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const sql = require('mssql');

router.use(protect);

// Get all leave requests for the logged-in teacher
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.BigInt, req.user.school_id)
            .input('user_id', sql.BigInt, req.user.id)
            .query(`
                SELECT id, start_date, end_date, reason, status, comment, created_at, updated_at
                FROM leave_requests
                WHERE school_id = @school_id AND user_id = @user_id AND user_role = 'teacher'
                ORDER BY created_at DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching teacher leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit a new leave request
router.post('/', audit('create_leave_request_teacher', 'leave_request'), async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { start_date, end_date, reason } = req.body;
        if (!start_date || !end_date || !reason) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.BigInt, req.user.school_id)
            .input('user_id', sql.BigInt, req.user.id)
            .input('start_date', sql.Date, start_date)
            .input('end_date', sql.Date, end_date)
            .input('reason', sql.NVarChar(sql.MAX), reason)
            .query(`
                INSERT INTO leave_requests (school_id, user_id, user_role, start_date, end_date, reason, status)
                OUTPUT INSERTED.*
                VALUES (@school_id, @user_id, 'teacher', @start_date, @end_date, @reason, 'pending')
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error submitting teacher leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
