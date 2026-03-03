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
        SELECT g.*, s.name as student_name
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.school_id = @school_id
        ORDER BY g.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', audit('create_grade', 'grade'), async (req, res) => {
  const { student_id, subject, term, score, max_score } = req.body;
  if (!student_id || !subject || !term || score === undefined || score === null) {
    return res.status(400).json({ message: 'student_id, subject, term, and score are required' });
  }
  try {
    const pool = await poolPromise;
    const validStudent = await pool.request()
      .input('student_id', sql.Int, student_id)
      .input('school_id', sql.Int, req.user.school_id)
      .query('SELECT id FROM students WHERE id = @student_id AND school_id = @school_id');
    if (!validStudent.recordset.length) {
      return res.status(400).json({ message: 'Invalid student for this school' });
    }

    await pool.request()
      .input('student_id', sql.Int, student_id)
      .input('subject', sql.VarChar(100), subject)
      .input('term', sql.VarChar(50), term)
      .input('score', sql.Decimal(5, 2), score)
      .input('max_score', sql.Decimal(5, 2), max_score || 100)
      .query(`
        INSERT INTO grades (student_id, subject, term, score, max_score)
        VALUES (@student_id, @subject, @term, @score, @max_score)
      `);
    res.status(201).json({ message: 'Grade added' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
