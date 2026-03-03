// routes/admin/announcements.js
const express = require('express');
const { protect, restrictTo } = require('../../middleware/auth');
const { poolPromise, sql } = require('../../config/db');
const { audit } = require('../../middleware/audit');
const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT * FROM announcements WHERE school_id = @school_id ORDER BY created_at DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', audit('create_announcement', 'announcement'), async (req, res) => {
    const { title, message, type = 'info' } = req.body;
    if (!title || !message) {
        return res.status(400).json({ message: 'Title and message are required' });
    }
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('title', sql.NVarChar(255), title)
            .input('message', sql.NVarChar(sql.MAX), message)
            .input('type', sql.VarChar(20), type)
            .query('INSERT INTO announcements (school_id, title, message, type) VALUES (@school_id, @title, @message, @type)');
        res.status(201).json({ message: 'Announcement posted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
