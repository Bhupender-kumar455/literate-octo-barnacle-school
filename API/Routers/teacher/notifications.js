const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
const { poolPromise, sql } = require('../../config/db');

router.use(protect, restrictTo('teacher'));

const getTeacherContext = async (pool, userId) => {
    const mapping = await pool.request()
        .input('user_id', sql.BigInt, userId)
        .query(`
            SELECT TOP 1 id AS teacher_id, school_id
            FROM teachers
            WHERE user_id = @user_id
        `);

    return mapping.recordset[0] || null;
};

// GET /api/teacher/notifications - fetch in-app notifications for this teacher
router.get('/', async (req, res) => {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 25;

    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) {
            return res.status(404).json({ message: 'Teacher mapping not found' });
        }

        const result = await pool.request()
            .input('school_id', sql.BigInt, teacherContext.school_id)
            .input('teacher_id', sql.BigInt, teacherContext.teacher_id)
            .input('user_id', sql.BigInt, req.user.id)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit)
                  id,
                  title,
                  message,
                  status,
                  channel,
                  recipient_type,
                  recipient_id,
                  created_at,
                  sent_at,
                  read_at,
                  metadata
                FROM notifications
                WHERE school_id = @school_id
                  AND channel = 'in_app'
                  AND (
                    recipient_type IN ('school', 'all')
                    OR (
                      recipient_type = 'teacher'
                      AND (recipient_id IS NULL OR recipient_id IN (@teacher_id, @user_id))
                    )
                  )
                  AND status IN ('queued', 'sent', 'read')
                  AND (scheduled_at IS NULL OR scheduled_at <= GETDATE())
                ORDER BY created_at DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/teacher/notifications/:id/read - mark a notification as read
router.put('/:id/read', async (req, res) => {
    const notificationId = Number(req.params.id);
    if (!Number.isFinite(notificationId)) {
        return res.status(400).json({ message: 'Invalid notification id' });
    }

    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) {
            return res.status(404).json({ message: 'Teacher mapping not found' });
        }

        const result = await pool.request()
            .input('id', sql.BigInt, notificationId)
            .input('school_id', sql.BigInt, teacherContext.school_id)
            .input('teacher_id', sql.BigInt, teacherContext.teacher_id)
            .input('user_id', sql.BigInt, req.user.id)
            .query(`
                UPDATE notifications
                SET status = 'read',
                    read_at = GETDATE(),
                    updated_at = GETDATE()
                WHERE id = @id
                  AND school_id = @school_id
                  AND channel = 'in_app'
                  AND (
                    recipient_type IN ('school', 'all')
                    OR (
                      recipient_type = 'teacher'
                      AND (recipient_id IS NULL OR recipient_id IN (@teacher_id, @user_id))
                    )
                  )
                  AND (scheduled_at IS NULL OR scheduled_at <= GETDATE())
            `);

        const affected = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
        if (!affected) return res.status(404).json({ message: 'Notification not found' });

        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
