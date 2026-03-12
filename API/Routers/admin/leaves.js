const express = require('express');
const router = express.Router();
const { poolPromise } = require('../../config/db');
const { audit } = require('../../middleware/audit');
const { protect } = require('../../middleware/auth');
const { queueNotificationForEvent } = require('../../services/notificationQueue');
const sql = require('mssql');

router.use(protect);

const formatDateText = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value || '');
    return parsed.toISOString().slice(0, 10);
};

const toStatusLabel = (status) => String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveLeaveRecipient = async (pool, leaveRequest, schoolId) => {
    const role = String(leaveRequest?.user_role || '').toLowerCase();
    const userId = Number(leaveRequest?.user_id);
    if (!Number.isFinite(userId)) return null;

    if (role === 'teacher') {
        const teacherResult = await pool.request()
            .input('school_id', sql.BigInt, schoolId)
            .input('user_id', sql.BigInt, userId)
            .query('SELECT id FROM teachers WHERE school_id = @school_id AND user_id = @user_id');
        const teacherId = teacherResult.recordset[0]?.id || null;
        return teacherId ? { recipientType: 'teacher', recipientId: teacherId } : null;
    }

    if (role === 'student') {
        const studentResult = await pool.request()
            .input('school_id', sql.BigInt, schoolId)
            .input('user_id', sql.BigInt, userId)
            .query('SELECT student_id FROM student_users WHERE school_id = @school_id AND user_id = @user_id');
        const studentId = studentResult.recordset[0]?.student_id || null;
        return studentId ? { recipientType: 'student', recipientId: studentId } : null;
    }

    return null;
};

// Get all leave requests for the school
router.get('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { status, role } = req.query;
        let query = `
            SELECT l.id, l.user_id, l.user_role, l.start_date, l.end_date, l.reason, l.status, l.comment, l.created_at, l.updated_at,
                   CASE 
                     WHEN l.user_role = 'student' THEN s.name
                     WHEN l.user_role = 'teacher' THEN u.name
                   END as user_name
            FROM leave_requests l
            LEFT JOIN users u ON l.user_id = u.id
            LEFT JOIN student_users su ON su.user_id = l.user_id AND l.user_role = 'student'
            LEFT JOIN students s ON s.id = su.student_id
            WHERE l.school_id = @school_id
        `;

        const pool = await poolPromise;
        const request = pool.request().input('school_id', sql.BigInt, req.user.school_id);

        if (status) {
            query += ` AND l.status = @status`;
            request.input('status', sql.VarChar(20), status);
        }
        if (role) {
            query += ` AND l.user_role = @role`;
            request.input('role', sql.VarChar(20), role);
        }

        query += ` ORDER BY l.created_at DESC`;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching admin leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update the status of a leave request
router.put('/:id', audit('update_leave_request', 'leave_request'), async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { status, comment } = req.body;
        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.BigInt, req.params.id)
            .input('school_id', sql.BigInt, req.user.school_id)
            .input('status', sql.VarChar(20), status)
            .input('comment', sql.NVarChar(sql.MAX), comment || null)
            .query(`
                UPDATE leave_requests
                SET status = @status, comment = @comment, updated_at = GETDATE()
                OUTPUT INSERTED.*
                WHERE id = @id AND school_id = @school_id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        const updatedLeave = result.recordset[0] || null;

        if (updatedLeave && ['approved', 'rejected'].includes(String(updatedLeave.status || '').toLowerCase())) {
            try {
                const recipient = await resolveLeaveRecipient(pool, updatedLeave, req.user.school_id);
                if (recipient?.recipientId) {
                    const statusLabel = toStatusLabel(updatedLeave.status);
                    const startDateText = formatDateText(updatedLeave.start_date);
                    const endDateText = formatDateText(updatedLeave.end_date);
                    const commentText = updatedLeave.comment ? ` Comment: ${updatedLeave.comment}` : '';

                    await queueNotificationForEvent({
                        eventKey: 'leave_approval',
                        fallbackChannels: ['in_app', 'whatsapp'],
                        schoolId: req.user.school_id,
                        recipientType: recipient.recipientType,
                        recipientId: recipient.recipientId,
                        title: `Leave Request ${statusLabel}`,
                        message: `Your leave request (${startDateText} to ${endDateText}) is ${statusLabel.toLowerCase()}.${commentText}`,
                        metadata: {
                            alert_type: 'leave_approval',
                            leave_request_id: Number(updatedLeave.id),
                            status: String(updatedLeave.status || '').toLowerCase(),
                            user_role: String(updatedLeave.user_role || '').toLowerCase(),
                            comment: updatedLeave.comment || null,
                            start_date: startDateText,
                            end_date: endDateText,
                        },
                        entityType: 'leave_request',
                        entityId: updatedLeave.id,
                        createdBy: req.user.id,
                        dedupe: {
                            perDay: true,
                            byEntity: true,
                            byTitle: true,
                        },
                    });
                }
            } catch (notificationErr) {
                console.error('Leave notification queue error:', notificationErr.message);
            }
        }

        res.json(updatedLeave);
    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
