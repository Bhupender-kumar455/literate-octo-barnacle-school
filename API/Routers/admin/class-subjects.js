const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT cs.*, c.grade, c.section, s.name as subject, u.name as teacher_name
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        JOIN subjects s ON cs.subject_id = s.id
        JOIN teachers t ON cs.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE c.school_id = @school_id
        ORDER BY c.grade, c.section, s.name
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', audit('assign_subject', 'class_subject'), async (req, res) => {
  const classId = Number(req.body.class_id);
  const subjectId = Number(req.body.subject_id);
  const teacherId = Number(req.body.teacher_id);

  if (!Number.isFinite(classId) || !Number.isFinite(subjectId) || !Number.isFinite(teacherId)) {
    return res.status(400).json({ message: 'class_id, subject_id, and teacher_id are required' });
  }
  try {
    const pool = await poolPromise;

    const classRes = await pool.request()
      .input('class_id', sql.BigInt, classId)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query('SELECT id FROM classes WHERE id = @class_id AND school_id = @school_id');
    if (!classRes.recordset.length) {
      return res.status(400).json({ message: 'Invalid class for this school' });
    }

    const subjectRes = await pool.request()
      .input('subject_id', sql.BigInt, subjectId)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query('SELECT id FROM subjects WHERE id = @subject_id AND school_id = @school_id');
    if (!subjectRes.recordset.length) {
      return res.status(400).json({ message: 'Invalid subject for this school' });
    }

    const teacherRes = await pool.request()
      .input('teacher_id', sql.BigInt, teacherId)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query('SELECT id FROM teachers WHERE id = @teacher_id AND school_id = @school_id');
    if (!teacherRes.recordset.length) {
      return res.status(400).json({ message: 'Invalid teacher for this school' });
    }

    const existing = await pool.request()
      .input('class_id', sql.BigInt, classId)
      .input('subject_id', sql.BigInt, subjectId)
      .query('SELECT id FROM class_subjects WHERE class_id = @class_id AND subject_id = @subject_id');
    if (existing.recordset.length) {
      return res.status(409).json({ message: 'Subject already assigned to this class' });
    }

    const result = await pool.request()
      .input('class_id', sql.BigInt, classId)
      .input('subject_id', sql.BigInt, subjectId)
      .input('teacher_id', sql.BigInt, teacherId)
      .query(`
        INSERT INTO class_subjects (class_id, subject_id, teacher_id)
        OUTPUT INSERTED.id
        VALUES (@class_id, @subject_id, @teacher_id)
      `);
    res.status(201).json({ id: result.recordset[0].id, message: 'Subject assigned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
