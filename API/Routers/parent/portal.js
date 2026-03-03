const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('parent'));

const getLinkedStudents = async (parentUserId, schoolId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('user_id', sql.BigInt, parentUserId)
    .input('school_id', sql.BigInt, schoolId)
    .query(`
      SELECT
        s.id,
        s.name,
        s.admission_no,
        s.roll_number,
        s.gender,
        s.dob,
        s.guardian_name,
        s.guardian_phone,
        s.address,
        c.grade,
        c.section,
        ps.relationship
      FROM students s
      JOIN parent_students ps ON s.id = ps.student_id
      JOIN parents p ON ps.parent_id = p.id
      JOIN classes c ON s.class_id = c.id
      WHERE p.user_id = @user_id AND p.school_id = @school_id
      ORDER BY s.name
    `);
  return result.recordset;
};

const verifyStudentAccess = async (req, res, next) => {
  const studentId = Number(req.params.id);
  if (!Number.isFinite(studentId)) {
    return res.status(400).json({ message: 'Invalid student ID' });
  }

  try {
    const students = await getLinkedStudents(req.user.id, req.user.school_id);
    const hasAccess = students.some((student) => Number(student.id) === studentId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied or student not found' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Error verifying student access' });
  }
};

router.get('/students', async (req, res) => {
  try {
    const students = await getLinkedStudents(req.user.id, req.user.school_id);
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/students/:id/profile', verifyStudentAccess, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('student_id', sql.BigInt, req.params.id)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query(`
        SELECT s.*, c.grade, c.section
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = @student_id AND s.school_id = @school_id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/students/:id/attendance', verifyStudentAccess, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('student_id', sql.BigInt, req.params.id)
      .query(`
        SELECT a.date, a.status, a.remarks, subj.name AS subject_name
        FROM attendance a
        LEFT JOIN class_subjects cs ON a.class_subject_id = cs.id
        LEFT JOIN subjects subj ON cs.subject_id = subj.id
        WHERE a.student_id = @student_id
        ORDER BY a.date DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/students/:id/grades', verifyStudentAccess, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('student_id', sql.BigInt, req.params.id)
      .query(`
        SELECT subject, term, score, max_score, created_at
        FROM grades
        WHERE student_id = @student_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/students/:id/fees', verifyStudentAccess, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('student_id', sql.BigInt, req.params.id)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query(`
        SELECT id, amount, due_date, status, created_at
        FROM fees_invoices
        WHERE student_id = @student_id AND school_id = @school_id
        ORDER BY due_date DESC, created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/students/:id/assignments', verifyStudentAccess, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('student_id', sql.BigInt, req.params.id)
      .query(`
        SELECT
          a.id,
          a.title,
          a.description,
          a.due_date,
          a.max_score,
          subj.name AS subject_name,
          sub.score,
          sub.status AS submission_status,
          sub.file_url,
          sub.text_content
        FROM assignments a
        JOIN class_subjects cs ON a.class_subject_id = cs.id
        JOIN subjects subj ON cs.subject_id = subj.id
        JOIN students st ON st.id = @student_id AND st.class_id = cs.class_id
        LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id AND sub.student_id = @student_id
        ORDER BY a.due_date DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.BigInt, req.user.school_id)
      .query(`
        SELECT id, title, message, type, created_at
        FROM announcements
        WHERE school_id = @school_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
