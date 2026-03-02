const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');
const { upload, convertFileToBase64, formatUploadError } = require('../../utils/fileHelper');

// RFC 4180 CSV cell escaping
const csvEscape = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

router.use(protect, restrictTo('admin'));

let studentColumnsEnsured = false;
const ensureStudentColumns = async (pool) => {
    if (studentColumnsEnsured) return;
    await pool.request().query(`
        IF COL_LENGTH('students', 'logo') IS NULL
        BEGIN
            ALTER TABLE students ADD logo NVARCHAR(MAX) NULL;
        END

        IF COL_LENGTH('students', 'fee_status') IS NULL
        BEGIN
            ALTER TABLE students ADD fee_status VARCHAR(20) NULL;
        END
    `);
    studentColumnsEnsured = true;
};

router.post('/logo', (req, res) => {
    upload.single('logo')(req, res, (error) => {
        if (error) {
            return res.status(400).json({ message: formatUploadError(error) });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({ url: fileUrl });
    });
});

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        await ensureStudentColumns(pool);
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .query(`
        SELECT s.*, c.grade + '-' + c.section AS class_name,
          CASE
            WHEN s.fee_status IS NOT NULL AND LTRIM(RTRIM(s.fee_status)) <> '' THEN
              CASE LOWER(s.fee_status)
                WHEN 'overdue' THEN 'Overdue'
                WHEN 'pending' THEN 'Pending'
                WHEN 'paid' THEN 'Paid'
                ELSE 'Pending'
              END
            WHEN EXISTS (SELECT 1 FROM fees_invoices fi WHERE fi.student_id = s.id AND fi.status = 'overdue') THEN 'Overdue'
            WHEN EXISTS (SELECT 1 FROM fees_invoices fi WHERE fi.student_id = s.id AND fi.status = 'pending') THEN 'Pending'
            WHEN EXISTS (SELECT 1 FROM fees_invoices fi WHERE fi.student_id = s.id AND fi.status = 'paid') THEN 'Paid'
            ELSE 'Pending'
          END AS fees_status
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.school_id = @school_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/export.csv', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .query(`
        SELECT s.id, s.name, s.admission_no, s.roll_number, s.gender, s.dob, s.guardian_name, s.guardian_phone,
               c.grade + '-' + c.section AS class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.school_id = @school_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
        const rows = result.recordset || [];
        const header = 'id,name,admission_no,roll_number,gender,dob,guardian_name,guardian_phone,class_name';
        const body = rows.map(r =>
            [r.id, r.name, r.admission_no, r.roll_number, r.gender, r.dob || '', r.guardian_name || '', r.guardian_phone || '', r.class_name]
                .map(csvEscape).join(',')
        ).join('\n');
        const csv = `${header}\n${body}`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/export.pdf', async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .query(`
        SELECT s.id, s.name, s.admission_no, s.roll_number, s.gender, s.dob, s.guardian_name, s.guardian_phone,
               c.grade + '-' + c.section AS class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.school_id = @school_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=students.pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Students', { align: 'center' });
        doc.moveDown();
        doc.fontSize(9).text('Name | Admission No | Roll | Class');
        doc.moveDown(0.5);
        result.recordset.forEach(r => {
            doc.text(`${r.name} | ${r.admission_no} | ${r.roll_number} | ${r.class_name}`);
        });
        doc.end();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', audit('create_student', 'student'), async (req, res) => {
    const { class_id, admission_no, roll_number, name, gender, dob, guardian_name, guardian_phone, address, logo, fees_status } = req.body;
    if (!class_id || !admission_no || !roll_number || !name) {
        return res.status(400).json({ message: 'class_id, admission_no, roll_number, and name are required' });
    }
    const normalizedGender = gender ? String(gender).toLowerCase() : null;
    let normalizedFeesStatus = null;
    if (fees_status !== undefined && fees_status !== null && String(fees_status).trim() !== '') {
        const mapped = String(fees_status).trim().toLowerCase();
        if (!['paid', 'pending', 'overdue'].includes(mapped)) {
            return res.status(400).json({ message: 'Invalid fees_status value' });
        }
        normalizedFeesStatus = mapped;
    }
    const logoBase64 = convertFileToBase64(logo);
    try {
        const pool = await poolPromise;
        await ensureStudentColumns(pool);
        const classRes = await pool.request()
            .input('class_id', sql.Int, class_id)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id FROM classes WHERE id = @class_id AND school_id = @school_id');
        if (!classRes.recordset.length) {
            return res.status(400).json({ message: 'Invalid class for this school' });
        }

        await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('class_id', sql.Int, class_id)
            .input('admission_no', sql.VarChar(50), admission_no)
            .input('roll_number', sql.Int, roll_number)
            .input('name', sql.NVarChar(255), name)
            .input('gender', sql.VarChar(10), normalizedGender)
            .input('dob', sql.Date, dob || null)
            .input('guardian_name', sql.NVarChar(255), guardian_name || null)
            .input('guardian_phone', sql.VarChar(15), guardian_phone || null)
            .input('address', sql.NVarChar(sql.MAX), address || null)
            .input('fee_status', sql.VarChar(20), normalizedFeesStatus)
            .input('logo', sql.NVarChar(sql.MAX), logoBase64 || null)
            .query(`
        INSERT INTO students (school_id, class_id, admission_no, roll_number, name, gender, dob, guardian_name, guardian_phone, address, fee_status, logo)
        VALUES (@school_id, @class_id, @admission_no, @roll_number, @name, @gender, @dob, @guardian_name, @guardian_phone, @address, @fee_status, @logo)
      `);
        res.status(201).json({ message: 'Student added' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', audit('update_student', 'student'), async (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId)) {
        return res.status(400).json({ message: 'Invalid student id' });
    }

    const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
    const hasClassId = hasField('class_id');
    const hasAdmissionNo = hasField('admission_no');
    const hasRollNumber = hasField('roll_number');
    const hasName = hasField('name');
    const hasGender = hasField('gender');
    const hasDob = hasField('dob');
    const hasGuardianName = hasField('guardian_name');
    const hasGuardianPhone = hasField('guardian_phone');
    const hasAddress = hasField('address');
    const hasLogo = hasField('logo');
    const hasFeesStatus = hasField('fees_status');

    if (!hasClassId && !hasAdmissionNo && !hasRollNumber && !hasName && !hasGender && !hasDob && !hasGuardianName && !hasGuardianPhone && !hasAddress && !hasLogo && !hasFeesStatus) {
        return res.status(400).json({ message: 'No fields provided for update' });
    }

    const classIdValue = hasClassId ? Number(req.body.class_id) : null;
    if (hasClassId && !Number.isFinite(classIdValue)) {
        return res.status(400).json({ message: 'Invalid class_id' });
    }

    const admissionNoValue = hasAdmissionNo ? String(req.body.admission_no || '').trim() : null;
    if (hasAdmissionNo && !admissionNoValue) {
        return res.status(400).json({ message: 'admission_no cannot be empty' });
    }

    const rollNumberValue = hasRollNumber ? Number(req.body.roll_number) : null;
    if (hasRollNumber && !Number.isFinite(rollNumberValue)) {
        return res.status(400).json({ message: 'Invalid roll_number' });
    }

    const nameValue = hasName ? String(req.body.name || '').trim() : null;
    if (hasName && !nameValue) {
        return res.status(400).json({ message: 'name cannot be empty' });
    }

    let genderValue = null;
    if (hasGender) {
        genderValue = req.body.gender ? String(req.body.gender).toLowerCase() : null;
        if (genderValue && !['male', 'female', 'other'].includes(genderValue)) {
            return res.status(400).json({ message: 'Invalid gender value' });
        }
    }

    const dobValue = hasDob ? (req.body.dob || null) : null;
    const guardianNameValue = hasGuardianName ? (req.body.guardian_name || null) : null;
    const guardianPhoneValue = hasGuardianPhone ? (req.body.guardian_phone || null) : null;
    const addressValue = hasAddress ? (req.body.address || null) : null;
    let feesStatusValue = null;
    if (hasFeesStatus) {
        const mapped = String(req.body.fees_status || '').trim().toLowerCase();
        if (!['paid', 'pending', 'overdue'].includes(mapped)) {
            return res.status(400).json({ message: 'Invalid fees_status value' });
        }
        feesStatusValue = mapped;
    }
    let logoValue = null;
    if (hasLogo) {
        const rawLogo = req.body.logo;
        if (!rawLogo) {
            logoValue = null;
        } else if (String(rawLogo).startsWith('data:')) {
            logoValue = String(rawLogo);
        } else {
            logoValue = convertFileToBase64(rawLogo);
            if (!logoValue) {
                return res.status(400).json({ message: 'Invalid logo file reference' });
            }
        }
    }

    try {
        const pool = await poolPromise;
        await ensureStudentColumns(pool);

        const existingStudent = await pool.request()
            .input('id', sql.Int, studentId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id FROM students WHERE id = @id AND school_id = @school_id');
        if (!existingStudent.recordset.length) {
            return res.status(404).json({ message: 'Student not found for this school' });
        }

        if (hasClassId) {
            const classRes = await pool.request()
                .input('class_id', sql.Int, classIdValue)
                .input('school_id', sql.Int, req.user.school_id)
                .query('SELECT id FROM classes WHERE id = @class_id AND school_id = @school_id');
            if (!classRes.recordset.length) {
                return res.status(400).json({ message: 'Invalid class for this school' });
            }
        }

        if (hasAdmissionNo) {
            const dup = await pool.request()
                .input('admission_no', sql.VarChar(50), admissionNoValue)
                .input('id', sql.Int, studentId)
                .query('SELECT id FROM students WHERE admission_no = @admission_no AND id <> @id');
            if (dup.recordset.length) {
                return res.status(409).json({ message: 'admission_no already exists' });
            }
        }

        await pool.request()
            .input('id', sql.Int, studentId)
            .input('school_id', sql.Int, req.user.school_id)
            .input('has_class_id', sql.Bit, hasClassId ? 1 : 0)
            .input('class_id', sql.Int, hasClassId ? classIdValue : null)
            .input('has_admission_no', sql.Bit, hasAdmissionNo ? 1 : 0)
            .input('admission_no', sql.VarChar(50), hasAdmissionNo ? admissionNoValue : null)
            .input('has_roll_number', sql.Bit, hasRollNumber ? 1 : 0)
            .input('roll_number', sql.Int, hasRollNumber ? rollNumberValue : null)
            .input('has_name', sql.Bit, hasName ? 1 : 0)
            .input('name', sql.NVarChar(255), hasName ? nameValue : null)
            .input('has_gender', sql.Bit, hasGender ? 1 : 0)
            .input('gender', sql.VarChar(10), hasGender ? genderValue : null)
            .input('has_dob', sql.Bit, hasDob ? 1 : 0)
            .input('dob', sql.Date, hasDob ? dobValue : null)
            .input('has_guardian_name', sql.Bit, hasGuardianName ? 1 : 0)
            .input('guardian_name', sql.NVarChar(255), hasGuardianName ? guardianNameValue : null)
            .input('has_guardian_phone', sql.Bit, hasGuardianPhone ? 1 : 0)
            .input('guardian_phone', sql.VarChar(15), hasGuardianPhone ? guardianPhoneValue : null)
            .input('has_address', sql.Bit, hasAddress ? 1 : 0)
            .input('address', sql.NVarChar(sql.MAX), hasAddress ? addressValue : null)
            .input('has_fee_status', sql.Bit, hasFeesStatus ? 1 : 0)
            .input('fee_status', sql.VarChar(20), hasFeesStatus ? feesStatusValue : null)
            .input('has_logo', sql.Bit, hasLogo ? 1 : 0)
            .input('logo', sql.NVarChar(sql.MAX), hasLogo ? logoValue : null)
            .query(`
                UPDATE students
                SET class_id = CASE WHEN @has_class_id = 1 THEN @class_id ELSE class_id END,
                    admission_no = CASE WHEN @has_admission_no = 1 THEN @admission_no ELSE admission_no END,
                    roll_number = CASE WHEN @has_roll_number = 1 THEN @roll_number ELSE roll_number END,
                    name = CASE WHEN @has_name = 1 THEN @name ELSE name END,
                    gender = CASE WHEN @has_gender = 1 THEN @gender ELSE gender END,
                    dob = CASE WHEN @has_dob = 1 THEN @dob ELSE dob END,
                    guardian_name = CASE WHEN @has_guardian_name = 1 THEN @guardian_name ELSE guardian_name END,
                    guardian_phone = CASE WHEN @has_guardian_phone = 1 THEN @guardian_phone ELSE guardian_phone END,
                    address = CASE WHEN @has_address = 1 THEN @address ELSE address END,
                    fee_status = CASE WHEN @has_fee_status = 1 THEN @fee_status ELSE fee_status END,
                    logo = CASE WHEN @has_logo = 1 THEN @logo ELSE logo END
                WHERE id = @id AND school_id = @school_id
            `);

        if (hasFeesStatus) {
            await pool.request()
                .input('student_id', sql.Int, studentId)
                .input('school_id', sql.Int, req.user.school_id)
                .input('status', sql.VarChar(20), feesStatusValue)
                .query(`
                    UPDATE fees_invoices
                    SET status = @status
                    WHERE student_id = @student_id AND school_id = @school_id
                `);
        }

        res.json({ message: 'Student updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create or attach a student portal user
router.post('/:id/create-user', audit('create_student_user', 'student'), async (req, res) => {
    const studentId = Number(req.params.id);
    const { email, password } = req.body;

    if (!Number.isFinite(studentId)) {
        return res.status(400).json({ message: 'Invalid student id' });
    }
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordValue = password || 'Welcome123';

    let transaction;
    try {
        const pool = await poolPromise;

        const studentRes = await pool.request()
            .input('id', sql.Int, studentId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id FROM students WHERE id = @id AND school_id = @school_id');
        if (!studentRes.recordset.length) {
            return res.status(404).json({ message: 'Student not found for this school' });
        }

        transaction = pool.transaction();
        await transaction.begin();

        const dupEmail = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .query('SELECT id FROM users WHERE email = @email');
        if (dupEmail.recordset.length) {
            await transaction.rollback();
            return res.status(409).json({ message: 'Email already in use' });
        }

        const hashed = await require('bcrypt').hash(passwordValue, 10);

        const userResult = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .input('password_hash', sql.VarChar(255), hashed)
            .input('name', sql.NVarChar(255), normalizedEmail.split('@')[0])
            .input('role', sql.VarChar(20), 'student')
            .input('is_active', sql.Bit, 1)
            .query(`
                INSERT INTO users (email, password_hash, name, role, is_active)
                OUTPUT INSERTED.id
                VALUES (@email, @password_hash, @name, @role, @is_active)
            `);

        const userId = userResult.recordset[0].id;

        await transaction.request()
            .input('user_id', sql.BigInt, userId)
            .input('student_id', sql.BigInt, studentId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .query(`
                INSERT INTO student_users (user_id, student_id, school_id)
                VALUES (@user_id, @student_id, @school_id)
            `);

        await transaction.commit();
        res.status(201).json({ message: 'Student portal user created', user_id: userId, temporary_password: passwordValue });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

// DELETE a student (and their portal user account if present)
router.delete('/:id', audit('delete_student', 'student'), async (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId)) {
        return res.status(400).json({ message: 'Invalid student id' });
    }

    let transaction;
    try {
        const pool = await poolPromise;

        // Ensure student belongs to this school
        const studentRes = await pool.request()
            .input('id', sql.Int, studentId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id FROM students WHERE id = @id AND school_id = @school_id');
        if (!studentRes.recordset.length) {
            return res.status(404).json({ message: 'Student not found for this school' });
        }

        transaction = pool.transaction();
        await transaction.begin();

        // Find linked portal user (if any)
        const portalRes = await transaction.request()
            .input('student_id', sql.Int, studentId)
            .query('SELECT user_id FROM student_users WHERE student_id = @student_id');
        const portalUserId = portalRes.recordset[0]?.user_id || null;

        // Remove student_users mapping
        await transaction.request()
            .input('student_id', sql.Int, studentId)
            .query('DELETE FROM student_users WHERE student_id = @student_id');

        // Remove portal user account
        if (portalUserId) {
            await transaction.request()
                .input('user_id', sql.Int, portalUserId)
                .query('DELETE FROM users WHERE id = @user_id');
        }

        // Remove attendance records for the student
        await transaction.request()
            .input('student_id', sql.Int, studentId)
            .query('DELETE FROM attendance WHERE student_id = @student_id');

        // Remove grade records
        await transaction.request()
            .input('student_id', sql.Int, studentId)
            .query('DELETE FROM grades WHERE student_id = @student_id');

        // Remove fee invoices
        await transaction.request()
            .input('student_id', sql.Int, studentId)
            .query('DELETE FROM fees_invoices WHERE student_id = @student_id');

        // Finally remove the student
        await transaction.request()
            .input('id', sql.Int, studentId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('DELETE FROM students WHERE id = @id AND school_id = @school_id');

        await transaction.commit();
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
