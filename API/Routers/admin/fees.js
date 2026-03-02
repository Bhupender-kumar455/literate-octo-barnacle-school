// routes/admin/fees.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

// RFC 4180 CSV cell escaping
const csvEscape = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

router.use(protect, restrictTo('admin'));

router.get('/stats', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT 
          COUNT(*) as total_students,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending
        FROM fees_invoices WHERE school_id = @school_id
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/invoices', audit('create_invoice', 'fees'), async (req, res) => {
  const { student_id, amount, due_date } = req.body;
  if (!student_id || amount === undefined || amount === null) {
    return res.status(400).json({ message: 'student_id and amount are required' });
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

    const invoiceResult = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .input('student_id', sql.Int, student_id)
      .input('amount', sql.Decimal(12, 2), amount)
      .input('due_date', sql.Date, due_date || null)
      .query(`
        INSERT INTO fees_invoices (school_id, student_id, amount, due_date, status)
        OUTPUT INSERTED.id
        VALUES (@school_id, @student_id, @amount, @due_date, 'pending')
      `);

    const invoiceId = invoiceResult.recordset[0]?.id;
    if (invoiceId) {
      try {
        await pool.request()
          .input('school_id', sql.Int, req.user.school_id)
          .input('recipient_id', sql.Int, student_id)
          .input('title', sql.NVarChar(255), 'New Fee Invoice')
          .input('message', sql.NVarChar(sql.MAX), `A new invoice of ${amount} has been generated${due_date ? `, due on ${due_date}` : ''}.`)
          .input('entity_type', sql.VarChar(50), 'fees_invoice')
          .input('entity_id', sql.Int, invoiceId)
          .input('created_by', sql.Int, req.user.id)
          .query(`
            INSERT INTO notifications
            (school_id, recipient_type, recipient_id, channel, title, message, status, entity_type, entity_id, created_by)
            VALUES
            (@school_id, 'student', @recipient_id, 'in_app', @title, @message, 'queued', @entity_type, @entity_id, @created_by)
          `);
      } catch (notificationErr) {
        // Notification queue is optional; keep invoice creation successful even if notification tables are not migrated yet.
        console.error('Notification queue error:', notificationErr.message);
      }
    }
    res.status(201).json({ message: 'Invoice generated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT fi.*, s.name as student_name
        FROM fees_invoices fi
        JOIN students s ON fi.student_id = s.id
        WHERE fi.school_id = @school_id
        ORDER BY fi.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/invoices.csv', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT fi.id, s.name as student_name, fi.amount, fi.due_date, fi.status, fi.created_at
        FROM fees_invoices fi
        JOIN students s ON fi.student_id = s.id
        WHERE fi.school_id = @school_id
        ORDER BY fi.created_at DESC
      `);
    const rows = result.recordset || [];
    const header = 'id,student_name,amount,due_date,status,created_at';
    const body = rows.map(r =>
      [r.id, r.student_name, r.amount, r.due_date || '', r.status, r.created_at]
        .map(csvEscape).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/invoices.pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT fi.id, s.name as student_name, fi.amount, fi.due_date, fi.status, fi.created_at
        FROM fees_invoices fi
        JOIN students s ON fi.student_id = s.id
        WHERE fi.school_id = @school_id
        ORDER BY fi.created_at DESC
      `);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.pdf');
    doc.pipe(res);
    doc.fontSize(16).text('Invoices', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text('ID | Student | Amount | Status | Date');
    doc.moveDown(0.5);
    result.recordset.forEach(r => {
      doc.text(`${r.id} | ${r.student_name} | ${r.amount} | ${r.status} | ${r.created_at}`);
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/invoices/:id/status', audit('update_invoice_status', 'fees'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const normalizedStatus = String(status || '').toLowerCase();
  if (!['paid', 'pending', 'overdue'].includes(normalizedStatus)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('school_id', sql.Int, req.user.school_id)
      .input('status', sql.VarChar(20), normalizedStatus)
      .query('UPDATE fees_invoices SET status = @status WHERE id = @id AND school_id = @school_id');

    const affected = Array.isArray(result.rowsAffected) ? (result.rowsAffected[0] || 0) : 0;
    if (!affected) {
      return res.status(404).json({ message: 'Invoice not found for this school' });
    }

    if (normalizedStatus === 'overdue') {
      try {
        await pool.request()
          .input('id', sql.Int, id)
          .input('school_id', sql.Int, req.user.school_id)
          .input('created_by', sql.Int, req.user.id)
          .query(`
            INSERT INTO notifications
            (school_id, recipient_type, recipient_id, channel, title, message, status, entity_type, entity_id, created_by)
            SELECT
              fi.school_id,
              'student',
              fi.student_id,
              'in_app',
              'Invoice Overdue',
              CONCAT('Invoice #', fi.id, ' is now overdue. Please clear dues at the earliest.'),
              'queued',
              'fees_invoice',
              fi.id,
              @created_by
            FROM fees_invoices fi
            WHERE fi.id = @id
              AND fi.school_id = @school_id
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.entity_type = 'fees_invoice'
                  AND n.entity_id = fi.id
                  AND n.title = 'Invoice Overdue'
              )
          `);
      } catch (notificationErr) {
        console.error('Overdue notification queue error:', notificationErr.message);
      }
    }
    res.json({ message: 'Invoice updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
