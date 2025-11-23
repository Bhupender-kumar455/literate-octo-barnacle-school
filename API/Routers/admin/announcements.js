// routes/admin/announcements.js
const express = require('express');
const { protect, restrictTo } = require('../../middleware/auth');
const router = express.Router();
router.use(protect, restrictTo('admin'));

router.get('/', async (req, res) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('school_id', req.user.school_id)
        .query(`SELECT * FROM announcements WHERE school_id = @school_id ORDER BY created_at DESC`);
    res.json(result.recordset);
});

router.post('/', async (req, res) => {
    const { title, message, type = 'info' } = req.body;
    const pool = await poolPromise;
    await pool.request()
        .input('school_id', req.user.school_id)
        .input('title', title)
        .input('message', message)
        .input('type', type)
        .query(`INSERT INTO announcements (school_id, title, message, type) VALUES (@school_id, @title, @message, @type)`);
    res.status(201).json({ message: "Announcement posted!" });
});

module.exports = router;