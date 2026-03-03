const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('teacher'));

// Helper to get teacher ID
const getTeacherId = async (req) => {
    const pool = await poolPromise;
    const teacherRes = await pool.request()
        .input('user_id', req.user.id)
        .query('SELECT id FROM teachers WHERE user_id = @user_id');
    if (!teacherRes.recordset.length) throw new Error('Teacher profile not found');
    return teacherRes.recordset[0].id;
};

// Get all assignments for the current teacher
router.get('/', async (req, res) => {
    try {
        const teacherId = await getTeacherId(req);
        const pool = await poolPromise;

        const result = await pool.request()
            .input('teacher_id', sql.Int, teacherId)
            .input('school_id', sql.Int, req.user.school_id)
            .query(`
                SELECT a.*, c.grade, c.section, s.name as subject_name
                FROM assignments a
                JOIN class_subjects cs ON a.class_subject_id = cs.id
                JOIN classes c ON cs.class_id = c.id
                JOIN subjects s ON cs.subject_id = s.id
                WHERE a.created_by = @teacher_id AND a.school_id = @school_id
                ORDER BY a.due_date DESC
            `);

        // Also fetch submission counts for each assignment
        const assignments = result.recordset;
        for (const assignment of assignments) {
            const subCount = await pool.request()
                .input('assignment_id', sql.Int, assignment.id)
                .query(`
                    SELECT 
                        COUNT(*) as total_submissions,
                        SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) as graded_count
                    FROM assignment_submissions 
                    WHERE assignment_id = @assignment_id
                `);
            assignment.total_submissions = subCount.recordset[0].total_submissions;
            assignment.graded_count = subCount.recordset[0].graded_count;
        }

        res.json(assignments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new assignment
router.post('/', audit('create_assignment', 'assignment'), async (req, res) => {
    const { class_subject_id, title, description, due_date, max_score } = req.body;

    if (!class_subject_id || !title || !due_date) {
        return res.status(400).json({ message: 'class_subject_id, title, and due_date are required' });
    }

    try {
        const teacherId = await getTeacherId(req);
        const pool = await poolPromise;

        // Verify the class_subject belongs to this teacher
        const validClassSubject = await pool.request()
            .input('cs_id', sql.Int, class_subject_id)
            .input('teacher_id', sql.Int, teacherId)
            .query('SELECT id FROM class_subjects WHERE id = @cs_id AND teacher_id = @teacher_id');

        if (!validClassSubject.recordset.length) {
            return res.status(403).json({ message: 'Not authorized for this class subject' });
        }

        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('class_subject_id', sql.Int, class_subject_id)
            .input('title', sql.NVarChar(255), title)
            .input('description', sql.NVarChar(sql.MAX), description || null)
            .input('due_date', sql.DateTime, new Date(due_date))
            .input('max_score', sql.Decimal(5, 2), max_score || 100)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
                INSERT INTO assignments (school_id, class_subject_id, title, description, due_date, max_score, created_by)
                OUTPUT INSERTED.id
                VALUES (@school_id, @class_subject_id, @title, @description, @due_date, @max_score, @teacher_id)
            `);

        res.status(201).json({
            message: 'Assignment created',
            id: result.recordset[0].id
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get submissions for a specific assignment
router.get('/:id/submissions', async (req, res) => {
    try {
        const teacherId = await getTeacherId(req);
        const pool = await poolPromise;

        // Verify assignment belongs to this teacher
        const validAssignment = await pool.request()
            .input('assignment_id', sql.Int, req.params.id)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
                SELECT a.id 
                FROM assignments a 
                WHERE a.id = @assignment_id AND a.created_by = @teacher_id
            `);

        if (!validAssignment.recordset.length) {
            return res.status(403).json({ message: 'Not authorized to view these submissions' });
        }

        // We want all students in the class, not just those who submitted
        const submissions = await pool.request()
            .input('assignment_id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    s.id as student_id,
                    s.name as student_name,
                    s.roll_number,
                    sub.id as submission_id,
                    sub.file_url,
                    sub.text_content,
                    sub.score,
                    sub.feedback,
                    sub.status,
                    sub.submitted_at,
                    sub.graded_at
                FROM assignments a
                JOIN class_subjects cs ON a.class_subject_id = cs.id
                JOIN students s ON cs.class_id = s.class_id
                LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id
                WHERE a.id = @assignment_id
                ORDER BY s.roll_number
            `);

        res.json(submissions.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Grade a submission
router.put('/submissions/:id', audit('grade_assignment', 'assignment_submission'), async (req, res) => {
    const { score, feedback, status = 'graded' } = req.body;

    if (score === undefined || score === null) {
        return res.status(400).json({ message: 'score is required' });
    }

    try {
        const teacherId = await getTeacherId(req);
        const pool = await poolPromise;

        // Verify submission is for an assignment belonging to this teacher
        const validSubmission = await pool.request()
            .input('submission_id', sql.Int, req.params.id)
            .input('teacher_id', sql.Int, teacherId)
            .query(`
                SELECT sub.id 
                FROM assignment_submissions sub
                JOIN assignments a ON sub.assignment_id = a.id
                WHERE sub.id = @submission_id AND a.created_by = @teacher_id
            `);

        if (!validSubmission.recordset.length) {
            return res.status(403).json({ message: 'Not authorized to grade this submission' });
        }

        await pool.request()
            .input('submission_id', sql.Int, req.params.id)
            .input('score', sql.Decimal(5, 2), score)
            .input('feedback', sql.NVarChar(sql.MAX), feedback || null)
            .input('status', sql.VarChar(20), status)
            .query(`
                UPDATE assignment_submissions
                SET score = @score,
                    feedback = @feedback,
                    status = @status,
                    graded_at = GETDATE()
                WHERE id = @submission_id
            `);

        res.json({ message: 'Submission graded successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
