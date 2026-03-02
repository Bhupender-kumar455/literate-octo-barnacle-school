const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const PDFDocument = require('pdfkit');

// RFC 4180 CSV cell escaping
const csvEscape = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

router.use(protect, restrictTo('admin'));

router.get('/attendance-summary', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(a.[date] AS DATE) AS date,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE s.school_id = @school_id
          AND (@from IS NULL OR a.[date] >= @from)
          AND (@to IS NULL OR a.[date] <= @to)
        GROUP BY CAST(a.[date] AS DATE)
        ORDER BY date DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/attendance-summary.csv', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(a.[date] AS DATE) AS date,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE s.school_id = @school_id
          AND (@from IS NULL OR a.[date] >= @from)
          AND (@to IS NULL OR a.[date] <= @to)
        GROUP BY CAST(a.[date] AS DATE)
        ORDER BY date DESC
      `);

    const rows = result.recordset || [];
    const header = 'date,present,absent,late';
    const body = rows.map(r =>
      [r.date, r.present, r.absent, r.late].map(csvEscape).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-summary.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/attendance-summary.pdf', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(a.[date] AS DATE) AS date,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE s.school_id = @school_id
          AND (@from IS NULL OR a.[date] >= @from)
          AND (@to IS NULL OR a.[date] <= @to)
        GROUP BY CAST(a.[date] AS DATE)
        ORDER BY date DESC
      `);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-summary.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('Attendance Summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Date | Present | Absent | Late');
    doc.moveDown(0.5);
    result.recordset.forEach(r => {
      doc.text(`${r.date} | ${r.present} | ${r.absent} | ${r.late}`);
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fee-collection', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(created_at AS DATE) AS date,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS collected,
          SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) AS pending
        FROM fees_invoices
        WHERE school_id = @school_id
          AND (@from IS NULL OR created_at >= @from)
          AND (@to IS NULL OR created_at <= @to)
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fee-collection.csv', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(created_at AS DATE) AS date,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS collected,
          SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) AS pending
        FROM fees_invoices
        WHERE school_id = @school_id
          AND (@from IS NULL OR created_at >= @from)
          AND (@to IS NULL OR created_at <= @to)
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
      `);

    const rows = result.recordset || [];
    const header = 'date,collected,pending';
    const body = rows.map(r =>
      [r.date, r.collected, r.pending].map(csvEscape).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=fee-collection.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/fee-collection.pdf', async (req, res) => {
  const { from, to } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('from', sql.Date, from || null)
      .input('to', sql.Date, to || null)
      .query(`
        SELECT 
          CAST(created_at AS DATE) AS date,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS collected,
          SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END) AS pending
        FROM fees_invoices
        WHERE school_id = @school_id
          AND (@from IS NULL OR created_at >= @from)
          AND (@to IS NULL OR created_at <= @to)
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
      `);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=fee-collection.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('Fee Collection', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Date | Collected | Pending');
    doc.moveDown(0.5);
    result.recordset.forEach(r => {
      doc.text(`${r.date} | ${r.collected} | ${r.pending}`);
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/academic-performance', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT 
          g.subject,
          g.term,
          AVG(CASE WHEN g.max_score = 0 THEN 0 ELSE (g.score / g.max_score) * 100 END) AS avg_percentage,
          COUNT(*) AS total_records
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.school_id = @school_id
        GROUP BY g.subject, g.term
        ORDER BY g.term, g.subject
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/academic-performance.pdf', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT 
          g.subject,
          g.term,
          AVG(CASE WHEN g.max_score = 0 THEN 0 ELSE (g.score / g.max_score) * 100 END) AS avg_percentage,
          COUNT(*) AS total_records
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.school_id = @school_id
        GROUP BY g.subject, g.term
        ORDER BY g.term, g.subject
      `);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=academic-performance.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('Academic Performance', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Subject | Term | Avg % | Records');
    doc.moveDown(0.5);
    result.recordset.forEach(r => {
      doc.text(`${r.subject} | ${r.term} | ${Number(r.avg_percentage).toFixed(2)} | ${r.total_records}`);
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/academic-performance.csv', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT 
          g.subject,
          g.term,
          AVG(CASE WHEN g.max_score = 0 THEN 0 ELSE (g.score / g.max_score) * 100 END) AS avg_percentage,
          COUNT(*) AS total_records
        FROM grades g
        JOIN students s ON g.student_id = s.id
        WHERE s.school_id = @school_id
        GROUP BY g.subject, g.term
        ORDER BY g.term, g.subject
      `);

    const rows = result.recordset || [];
    const header = 'subject,term,avg_percentage,total_records';
    const body = rows.map(r =>
      [r.subject, r.term, r.avg_percentage, r.total_records].map(csvEscape).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=academic-performance.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/downloads', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT TOP 20 report_type, file_name, created_at
        FROM report_downloads
        WHERE school_id = @school_id
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/downloads', audit('report_download', 'report'), async (req, res) => {
  const { report_type, file_name } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('report_type', sql.VarChar(50), report_type)
      .input('file_name', sql.NVarChar(255), file_name)
      .input('created_by', sql.Int, req.user.id)
      .query(`
        INSERT INTO report_downloads (school_id, report_type, file_name, created_by)
        VALUES (@school_id, @report_type, @file_name, @created_by)
      `);
    res.json({ message: 'Download logged' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
