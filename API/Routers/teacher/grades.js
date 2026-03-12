const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const { queueNotificationForEvent } = require('../../services/notificationQueue');

router.use(protect, restrictTo('teacher'));

// Get all grades for students in classes taught by the current teacher
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;

        // Get teacher ID
        const teacherRes = await pool.request()
            .input('user_id', req.user.id)
            .query('SELECT id FROM teachers WHERE user_id = @user_id');
        if (!teacherRes.recordset.length) return res.json([]);
        const teacherId = teacherRes.recordset[0].id;

        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
        SELECT DISTINCT g.*, s.name as student_name
        FROM grades g
        JOIN students s ON g.student_id = s.id
        JOIN class_subjects cs ON cs.class_id = s.class_id
        WHERE s.school_id = @school_id 
          AND cs.teacher_id = @teacher_id
        ORDER BY g.created_at DESC
      `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add a new grade for a student
router.post('/', audit('create_grade_teacher', 'grade'), async (req, res) => {
    const { student_id, subject, term, score, max_score } = req.body;
    if (!student_id || !subject || !term || score === undefined || score === null) {
        return res.status(400).json({ message: 'student_id, subject, term, and score are required' });
    }
    try {
        const pool = await poolPromise;

        // Get teacher ID
        const teacherRes = await pool.request()
            .input('user_id', req.user.id)
            .query('SELECT id FROM teachers WHERE user_id = @user_id');
        if (!teacherRes.recordset.length) return res.status(403).json({ message: 'Teacher profile not found' });
        const teacherId = teacherRes.recordset[0].id;

        // Validate student is in a class taught by this teacher
        const validStudent = await pool.request()
            .input('student_id', sql.Int, student_id)
            .input('school_id', sql.Int, req.user.school_id)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
        SELECT s.id 
        FROM students s
        JOIN class_subjects cs ON cs.class_id = s.class_id
        WHERE s.id = @student_id 
          AND s.school_id = @school_id
          AND cs.teacher_id = @teacher_id
      `);

        if (!validStudent.recordset.length) {
            return res.status(403).json({ message: 'Not authorized to grade this student or student not found' });
        }

        const gradeInsert = await pool.request()
            .input('student_id', sql.Int, student_id)
            .input('subject', sql.VarChar(100), subject)
            .input('term', sql.VarChar(50), term)
            .input('score', sql.Decimal(5, 2), score)
            .input('max_score', sql.Decimal(5, 2), max_score || 100)
            .query(`
        INSERT INTO grades (student_id, subject, term, score, max_score)
        OUTPUT INSERTED.id, INSERTED.subject, INSERTED.term, INSERTED.score, INSERTED.max_score
        VALUES (@student_id, @subject, @term, @score, @max_score)
      `);

        const grade = gradeInsert.recordset[0] || null;
        if (grade?.id) {
            try {
                await queueNotificationForEvent({
                    eventKey: 'result_alert',
                    fallbackChannels: ['in_app', 'whatsapp'],
                    schoolId: req.user.school_id,
                    recipientType: 'student',
                    recipientId: student_id,
                    title: 'New Result Published',
                    message: `Result update: ${grade.subject} (${grade.term}) score is ${grade.score}/${grade.max_score}.`,
                    metadata: {
                        alert_type: 'result_alert',
                        grade_id: Number(grade.id),
                        subject: String(grade.subject || ''),
                        term: String(grade.term || ''),
                        score: Number(grade.score),
                        max_score: Number(grade.max_score)
                    },
                    entityType: 'grade',
                    entityId: grade.id,
                    createdBy: req.user.id
                });
            } catch (notificationErr) {
                console.error('Result notification queue error:', notificationErr.message);
            }
        }
        res.status(201).json({ message: 'Grade added' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Optional: Delete a grade
router.delete('/:id', audit('delete_grade_teacher', 'grade'), async (req, res) => {
    try {
        const pool = await poolPromise;

        // Get teacher ID
        const teacherRes = await pool.request()
            .input('user_id', req.user.id)
            .query('SELECT id FROM teachers WHERE user_id = @user_id');
        if (!teacherRes.recordset.length) return res.status(403).json({ message: 'Teacher profile not found' });
        const teacherId = teacherRes.recordset[0].id;

        // Verify grade belongs to a student this teacher teaches
        const validGrade = await pool.request()
            .input('grade_id', sql.Int, req.params.id)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
            SELECT g.id 
            FROM grades g
            JOIN students s ON g.student_id = s.id
            JOIN class_subjects cs ON cs.class_id = s.class_id
            WHERE g.id = @grade_id AND cs.teacher_id = @teacher_id
        `);

        if (!validGrade.recordset.length) {
            return res.status(403).json({ message: 'Not authorized to delete this grade or grade not found' });
        }

        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM grades WHERE id = @id');

        res.json({ message: 'Grade deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
