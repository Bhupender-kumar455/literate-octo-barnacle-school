const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { getStudentReportCardData, streamReportCardPdf } = require('../../utils/reportCard');

router.use(protect, restrictTo('admin'));

router.get('/students/:studentId/terms', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isFinite(studentId)) {
    return res.status(400).json({ message: 'Invalid student id' });
  }
  try {
    const pool = await poolPromise;
    const validStudent = await pool.request()
      .input('student_id', sql.BigInt, studentId)
      .input('school_id', sql.BigInt, req.user.school_id)
      .query('SELECT id FROM students WHERE id = @student_id AND school_id = @school_id');
    if (!validStudent.recordset.length) {
      return res.status(404).json({ message: 'Student not found for this school' });
    }

    const termsRes = await pool.request()
      .input('student_id', sql.BigInt, studentId)
      .query(`
        SELECT term, MAX(created_at) AS latest_at
        FROM grades
        WHERE student_id = @student_id
        GROUP BY term
        ORDER BY latest_at DESC
      `);
    res.json(termsRes.recordset.map((row) => row.term));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/students/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const requestedTerm = req.query.term ? String(req.query.term) : null;
  if (!Number.isFinite(studentId)) {
    return res.status(400).json({ message: 'Invalid student id' });
  }

  try {
    const pool = await poolPromise;
    const reportCard = await getStudentReportCardData(pool, req.user.school_id, studentId, requestedTerm);
    if (!reportCard) {
      return res.status(404).json({ message: 'Student not found for this school' });
    }
    res.json(reportCard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/students/:studentId/pdf', async (req, res) => {
  const studentId = Number(req.params.studentId);
  const requestedTerm = req.query.term ? String(req.query.term) : null;
  if (!Number.isFinite(studentId)) {
    return res.status(400).json({ message: 'Invalid student id' });
  }

  try {
    const pool = await poolPromise;
    const reportCard = await getStudentReportCardData(pool, req.user.school_id, studentId, requestedTerm);
    if (!reportCard) {
      return res.status(404).json({ message: 'Student not found for this school' });
    }
    streamReportCardPdf(res, reportCard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
