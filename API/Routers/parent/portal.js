import express from 'express';
import { getDbConnection, requireAuth } from '../../db.js';

const router = express.Router();

router.use(requireAuth);

// Middleware to ensure user is a parent
const requireParent = (req, res, next) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access denied. Parent role required." });
    }
    next();
};

router.use(requireParent);

// Helper function to get linked students for the parent
const getLinkedStudents = async (parentUserId, schoolId) => {
    const pool = await getDbConnection();
    const result = await pool.request()
        .input('userId', parentUserId)
        .input('schoolId', schoolId)
        .query(`
            SELECT s.*, c.grade, c.section, ps.relationship
            FROM students s
            JOIN parent_students ps ON s.id = ps.student_id
            JOIN parents p ON ps.parent_id = p.id
            JOIN classes c ON s.class_id = c.id
            WHERE p.user_id = @userId AND p.school_id = @schoolId
        `);
    return result.recordset;
};

// Get linked students
router.get('/students', async (req, res) => {
    try {
        const students = await getLinkedStudents(req.user.id, req.user.school_id);
        res.json(students);
    } catch (error) {
        console.error('Error fetching parent students:', error);
        res.status(500).json({ message: "Server error" });
    }
});

// Middleware to verify student belongs to parent
const verifyStudentAccess = async (req, res, next) => {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) return res.status(400).json({ message: "Invalid student ID" });

    try {
        const students = await getLinkedStudents(req.user.id, req.user.school_id);
        const hasAccess = students.some(s => s.id === studentId);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied or student not found" });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: "Error verifying access" });
    }
};

// Get student profile
router.get('/students/:id/profile', verifyStudentAccess, async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('studentId', req.params.id)
            .input('schoolId', req.user.school_id)
            .query(`
                SELECT s.*, c.grade, c.section
                FROM students s
                JOIN classes c ON s.class_id = c.id
                WHERE s.id = @studentId AND s.school_id = @schoolId
            `);

        if (result.recordset.length === 0) return res.status(404).json({ message: "Student not found" });
        res.json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get student attendance
router.get('/students/:id/attendance', verifyStudentAccess, async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('studentId', req.params.id)
            .query(`
                SELECT a.*, sub.name as subject_name
                FROM attendance a
                LEFT JOIN class_subjects cs ON a.class_subject_id = cs.id
                LEFT JOIN subjects sub ON cs.subject_id = sub.id
                WHERE a.student_id = @studentId
                ORDER BY a.date DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get student grades
router.get('/students/:id/grades', verifyStudentAccess, async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('studentId', req.params.id)
            .query(`
                SELECT g.*, sub.name as subject_name
                FROM grades g
                JOIN subjects sub ON g.subject_id = sub.id
                WHERE g.student_id = @studentId
                ORDER BY g.created_at DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get student fees
router.get('/students/:id/fees', verifyStudentAccess, async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('studentId', req.params.id)
            .query(`
                SELECT * FROM invoices
                WHERE student_id = @studentId
                ORDER BY due_date DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get student assignments
router.get('/students/:id/assignments', verifyStudentAccess, async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('studentId', req.params.id)
            .query(`
                SELECT a.*, sub.name as subject_name, sub.code as subject_code,
                       s.score, s.status as submission_status, s.file_url, s.text_content
                FROM assignments a
                JOIN class_subjects cs ON a.class_subject_id = cs.id
                JOIN subjects sub ON cs.subject_id = sub.id
                LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = @studentId
                JOIN students st ON st.id = @studentId AND st.class_id = cs.class_id
                ORDER BY a.due_date DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get announcements
router.get('/announcements', async (req, res) => {
    try {
        const pool = await getDbConnection();
        const result = await pool.request()
            .input('schoolId', req.user.school_id)
            .query('SELECT * FROM announcements WHERE school_id = @schoolId ORDER BY created_at DESC');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
