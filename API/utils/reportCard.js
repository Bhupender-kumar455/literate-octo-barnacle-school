const PDFDocument = require('pdfkit');
const { sql } = require('../config/db');

const getGradeBand = (percentage) => {
  if (!Number.isFinite(percentage)) return 'N/A';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

const toFixedNumber = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(digits));
};

const getStudentReportCardData = async (pool, schoolId, studentId, requestedTerm) => {
  const studentRes = await pool.request()
    .input('student_id', sql.BigInt, studentId)
    .input('school_id', sql.BigInt, schoolId)
    .query(`
      SELECT s.id, s.name, s.admission_no, s.roll_number, s.guardian_name, s.guardian_phone,
             c.grade, c.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = @student_id AND s.school_id = @school_id
    `);
  if (!studentRes.recordset.length) return null;
  const student = studentRes.recordset[0];

  let resolvedTerm = requestedTerm || null;
  if (!resolvedTerm) {
    const latestTermRes = await pool.request()
      .input('student_id', sql.BigInt, studentId)
      .query(`
        SELECT TOP 1 term
        FROM grades
        WHERE student_id = @student_id
        ORDER BY created_at DESC
      `);
    resolvedTerm = latestTermRes.recordset[0]?.term || null;
  }

  const gradesRes = await pool.request()
    .input('student_id', sql.BigInt, studentId)
    .input('term', sql.VarChar(50), resolvedTerm)
    .query(`
      SELECT subject, term, score, max_score, created_at
      FROM grades
      WHERE student_id = @student_id
        AND (@term IS NULL OR term = @term)
      ORDER BY subject
    `);

  const subjects = gradesRes.recordset.map((row) => {
    const score = Number(row.score || 0);
    const maxScore = Number(row.max_score || 0);
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    return {
      subject: row.subject,
      term: row.term,
      score,
      max_score: maxScore,
      percentage: toFixedNumber(percentage, 2),
      band: getGradeBand(percentage),
    };
  });

  const totalScore = subjects.reduce((sum, row) => sum + row.score, 0);
  const totalMaxScore = subjects.reduce((sum, row) => sum + row.max_score, 0);
  const overallPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

  return {
    student: {
      id: student.id,
      name: student.name,
      admission_no: student.admission_no,
      roll_number: student.roll_number,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      class_name: `${student.grade}-${student.section}`,
    },
    term: resolvedTerm,
    subjects,
    summary: {
      total_subjects: subjects.length,
      total_score: toFixedNumber(totalScore, 2),
      total_max_score: toFixedNumber(totalMaxScore, 2),
      percentage: toFixedNumber(overallPercentage, 2),
      grade: getGradeBand(overallPercentage),
      pass: overallPercentage >= 40,
    }
  };
};

const streamReportCardPdf = (res, reportCard) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const safeStudentName = String(reportCard.student.name || 'student').replace(/\s+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=report-card-${safeStudentName}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).text('Student Report Card', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(11);
  doc.text(`Name: ${reportCard.student.name}`);
  doc.text(`Class: ${reportCard.student.class_name}`);
  doc.text(`Admission No: ${reportCard.student.admission_no}`);
  doc.text(`Roll Number: ${reportCard.student.roll_number}`);
  doc.text(`Term: ${reportCard.term || 'All Terms'}`);
  doc.moveDown(1);

  doc.fontSize(10).text('Subject | Score | Max | % | Grade');
  doc.moveDown(0.5);

  if (!reportCard.subjects.length) {
    doc.text('No grades available for the selected term.');
  } else {
    reportCard.subjects.forEach((row) => {
      doc.text(`${row.subject} | ${row.score} | ${row.max_score} | ${row.percentage}% | ${row.band}`);
    });
  }

  doc.moveDown(1);
  doc.fontSize(11).text(`Total: ${reportCard.summary.total_score} / ${reportCard.summary.total_max_score}`);
  doc.text(`Overall Percentage: ${reportCard.summary.percentage}%`);
  doc.text(`Overall Grade: ${reportCard.summary.grade}`);
  doc.text(`Result: ${reportCard.summary.pass ? 'Pass' : 'Needs Improvement'}`);
  doc.end();
};

module.exports = {
  getGradeBand,
  toFixedNumber,
  getStudentReportCardData,
  streamReportCardPdf,
};
