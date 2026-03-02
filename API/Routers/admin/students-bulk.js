// routes/admin/students-bulk.js - bulk upload
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

// Multer config - accept Excel files
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files allowed!'));
        }
    }
});

router.post('/bulk', audit('bulk_upload_students', 'student'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const school_id = req.user.school_id;
    let transaction;

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        const pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        let success = 0;
        let errors = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;
            let hasError = false;
            let errorMsg = '';
            let class_id = null;

            try {
                // === 1. Convert Excel serial date to YYYY-MM-DD ===
                let dob = null;
                if (row.dob || row.DOB || row['Date of Birth']) {
                    const rawDob = row.dob || row.DOB || row['Date of Birth'];
                    if (typeof rawDob === 'number') {
                        const jsDate = new Date((rawDob - 25569) * 86400 * 1000);
                        dob = jsDate.toISOString().split('T')[0];
                    } else if (typeof rawDob === 'string') {
                        const parsed = new Date(rawDob);
                        if (!isNaN(parsed.getTime())) {
                            dob = parsed.toISOString().split('T')[0];
                        }
                    }
                }
                // === 2. Find class_id (super flexible) ===
                const grade = String(row.grade || row.Grade || row.Class || row.class || '').trim();
                const section = String(row.section || row.Section || row.Sec || '').trim().toUpperCase();

                if (!grade || !section) {
                    throw new Error(`Missing grade/section (Grade: "${grade}", Section: "${section}")`);
                }

                const classRes = await transaction.request()
                    .input('school_id', school_id)
                    .input('grade', grade)
                    .input('section', section)
                    .query(`SELECT id FROM classes WHERE school_id = @school_id AND grade = @grade AND section = @section`);

                if (classRes.recordset.length === 0) {
                    const newClassRes = await transaction.request()
                        .input('school_id', school_id)
                        .input('grade', grade)
                        .input('section', section)
                        .query(`INSERT INTO classes (school_id, grade, section, academic_year) 
            OUTPUT INSERTED.id 
            VALUES (@school_id, @grade, @section, '2025-2026')`);

                    class_id = newClassRes.recordset[0].id;
                    console.log(`Auto-created class: ${grade}-${section}`);
                }
                else {
                    class_id = classRes.recordset[0].id;
                }

                // === 3. Generate admission_no if missing ===
                const admission_no = row.admission_no || row.Admission_No || row['Admission No'] || `ADM${Date.now().toString().slice(-6)}${String(i + 1).padStart(3, '0')}`;


                // === 4. INSERT STUDENT ===
                await transaction.request()
                    .input('school_id', school_id)
                    .input('class_id', class_id)
                    .input('admission_no', String(admission_no))
                    .input('roll_number', Number(row.roll_number || row.Roll_Number || (i + 1)))
                    .input('name', String(row.name || row.Name || row.Student_Name || 'Unknown Student'))
                    .input('gender', String(row.gender || row.Gender || 'Other').trim().toLowerCase())
                    .input('dob', dob)
                    .input('guardian_name', String(row.guardian_name || row.Guardian_Name || row.father_name || 'Guardian'))
                    .input('guardian_phone', String(row.guardian_phone || row.Phone || ''))
                    .input('address', String(row.address || row.Address || ''))
                    .query(`
        INSERT INTO students 
        (school_id, class_id, admission_no, roll_number, name, gender, dob, guardian_name, guardian_phone, address)
        VALUES (@school_id, @class_id, @admission_no, @roll_number, @name, @gender, @dob, @guardian_name, @guardian_phone, @address)
      `);

                success++;

            } catch (err) {
                errors.push(`Row ${rowNum}: ${err.message}`);
            }
        }

        await transaction.commit();

        res.json({
            message: `Bulk upload complete!`,
            success,
            failed: errors.length,
            errors
        });

    } catch (err) {
        console.log("error", err);
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
}
);

module.exports = router;
