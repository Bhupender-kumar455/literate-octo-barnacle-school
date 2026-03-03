const express = require('express');
const router = express.Router();
const { upload, convertFileToBase64, formatUploadError } = require('../../utils/fileHelper');
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { audit } = require('../../middleware/audit');
const { validateStrongPassword } = require('../../utils/password');
const { parseSpreadsheetRows } = require('../../utils/spreadsheet');

router.use(protect, restrictTo('admin'));

const bulkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const mimetype = String(file.mimetype || '').toLowerCase();
        const originalname = String(file.originalname || '').toLowerCase();
        const isExcelOrCsv = mimetype.includes('spreadsheet')
            || mimetype.includes('excel')
            || mimetype.includes('csv')
            || /\.(xlsx|csv)$/.test(originalname);

        if (!isExcelOrCsv) {
            return cb(new Error('Only CSV/XLSX files allowed!'));
        }
        return cb(null, true);
    }
});

const normalizeJoinDate = (rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return '';

    if (typeof rawValue === 'number') {
        const jsDate = new Date((rawValue - 25569) * 86400 * 1000);
        if (!Number.isNaN(jsDate.getTime())) {
            return jsDate.toISOString().split('T')[0];
        }
    }

    if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
        return rawValue.toISOString().split('T')[0];
    }

    const text = String(rawValue).trim();
    if (!text) return '';

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return text;
};

const normalizeActiveFlag = (rawValue) => {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return 1;
    const value = String(rawValue).trim().toLowerCase();
    return ['active', '1', 'true', 'yes', 'y'].includes(value) ? 1 : 0;
};

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
        const text = String(value).trim();
        return text ? text : null;
    }
    return null;
};

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .query(`
        SELECT t.*, u.name, u.email, u.phone, u.is_active
        FROM teachers t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.school_id = @school_id
      `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

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

router.post('/', audit('create_teacher', 'teacher'), async (req, res) => {
    const { name, email, password, department, logo, phone, status, address, joinDate } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.ok) {
        return res.status(400).json({ message: passwordValidation.message });
    }
    const isActive = status === undefined
        ? 1
        : (String(status).toLowerCase() === 'active' || status === 1 || status === true) ? 1 : 0;

    const logoBase64 = convertFileToBase64(logo);
    const employeeId = `EMP-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    let transaction;
    try {
        const pool = await poolPromise;
        const hashed = await bcrypt.hash(String(password), 10);

        transaction = pool.transaction();
        await transaction.begin();

        const existing = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .query('SELECT id FROM users WHERE email = @email');
        if (existing.recordset.length) {
            await transaction.rollback();
            return res.status(409).json({ message: 'Email already exists' });
        }

        const userResult = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .input('password_hash', sql.VarChar(255), hashed)
            .input('name', sql.NVarChar(255), name)
            .input('role', sql.VarChar(20), 'teacher')
            .input('phone', sql.VarChar(50), phone || null)
            .input('is_active', sql.Bit, isActive)
            .query(`INSERT INTO users (email, password_hash, name, role, phone, is_active) OUTPUT INSERTED.id VALUES (@email, @password_hash, @name, @role, @phone, @is_active)`);
        const userId = userResult.recordset[0].id;

        await transaction.request()
            .input('user_id', sql.BigInt, userId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .input('employee_id', sql.VarChar(50), employeeId)
            .input('department', sql.NVarChar(100), department || null)
            .input('logo', sql.NVarChar(sql.MAX), logoBase64 || null)
            .input('address', sql.NVarChar(sql.MAX), address || null)
            .input('joinDate', sql.NVarChar(100), joinDate || null)
            .input('created_by', sql.BigInt, req.user.id)
            .query(`INSERT INTO teachers (user_id, school_id, employee_id, department, logo, created_by, joinDate, address) VALUES (@user_id, @school_id, @employee_id, @department, @logo, @created_by, @joinDate, @address)`);
        await transaction.commit();
        res.status(201).json({ message: 'Teacher created with login' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

router.post('/bulk', audit('bulk_upload_teachers', 'teacher'), bulkUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const schoolId = req.user.school_id;
    let transaction;

    try {
        const rows = await parseSpreadsheetRows(req.file);
        if (!rows.length) {
            return res.status(400).json({ message: 'File has no data rows' });
        }

        const pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        let success = 0;
        const errors = [];
        const seenEmails = new Set();

        for (let i = 0; i < rows.length; i++) {
            const rowNumber = i + 2;
            const row = rows[i] || {};

            try {
                const name = String(row.name || row.teacher_name || '').trim();
                const email = String(row.email || row.email_address || '').trim().toLowerCase();
                const password = String(row.password || '').trim();
                const phone = String(row.phone || row.mobile || row.phone_number || '').trim();
                const department = String(row.department || row.subject || row.specialization || '').trim();
                const address = String(row.address || '').trim();
                const joinDate = normalizeJoinDate(row.joindate || row.join_date || row.joining_date);
                const isActive = normalizeActiveFlag(row.status || row.is_active || row.active);

                if (!name) throw new Error('name is required');
                if (!email) throw new Error('email is required');
                if (!password) throw new Error('password is required');
                const passwordValidation = validateStrongPassword(password);
                if (!passwordValidation.ok) throw new Error(passwordValidation.message);
                if (seenEmails.has(email)) throw new Error('Duplicate email in upload file');
                seenEmails.add(email);

                const existingUser = await transaction.request()
                    .input('email', sql.VarChar(255), email)
                    .query('SELECT id FROM users WHERE email = @email');

                if (existingUser.recordset.length) {
                    throw new Error('Email already exists');
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                const userResult = await transaction.request()
                    .input('email', sql.VarChar(255), email)
                    .input('password_hash', sql.VarChar(255), hashedPassword)
                    .input('name', sql.NVarChar(255), name)
                    .input('role', sql.VarChar(20), 'teacher')
                    .input('phone', sql.VarChar(50), phone || null)
                    .input('is_active', sql.Bit, isActive)
                    .query(`
                        INSERT INTO users (email, password_hash, name, role, phone, is_active)
                        OUTPUT INSERTED.id
                        VALUES (@email, @password_hash, @name, @role, @phone, @is_active)
                    `);

                const userId = userResult.recordset[0].id;
                const employeeId = `EMP-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}-${String(i + 1).padStart(3, '0')}`;

                await transaction.request()
                    .input('user_id', sql.BigInt, userId)
                    .input('school_id', sql.BigInt, schoolId)
                    .input('employee_id', sql.VarChar(50), employeeId)
                    .input('department', sql.NVarChar(100), department || null)
                    .input('logo', sql.NVarChar(sql.MAX), null)
                    .input('address', sql.NVarChar(sql.MAX), address || null)
                    .input('joinDate', sql.NVarChar(100), joinDate || null)
                    .input('created_by', sql.BigInt, req.user.id)
                    .query(`
                        INSERT INTO teachers (user_id, school_id, employee_id, department, logo, created_by, joinDate, address)
                        VALUES (@user_id, @school_id, @employee_id, @department, @logo, @created_by, @joinDate, @address)
                    `);

                success++;
            } catch (err) {
                errors.push(`Row ${rowNumber}: ${err.message}`);
            }
        }

        await transaction.commit();
        return res.json({
            message: 'Bulk upload complete!',
            success,
            failed: errors.length,
            errors
        });
    } catch (err) {
        if (transaction) await transaction.rollback();
        return res.status(500).json({ message: err.message });
    }
});

router.put('/:id', audit('update_teacher', 'teacher'), async (req, res) => {
    const teacherId = Number(req.params.id);
    if (!Number.isFinite(teacherId)) {
        return res.status(400).json({ message: 'Invalid teacher id' });
    }

    const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
    const hasName = hasField('name');
    const hasEmail = hasField('email');
    const hasPhone = hasField('phone');
    const hasDepartment = hasField('department');
    const hasJoinDate = hasField('joinDate');
    const hasAddress = hasField('address');
    const hasLogo = hasField('logo');
    const hasIsActive = hasField('is_active');

    if (!hasName && !hasEmail && !hasPhone && !hasDepartment && !hasJoinDate && !hasAddress && !hasLogo && !hasIsActive) {
        return res.status(400).json({ message: 'No fields provided for update' });
    }

    const nameValue = hasName ? String(req.body.name || '').trim() : null;
    if (hasName && !nameValue) {
        return res.status(400).json({ message: 'name cannot be empty' });
    }

    const emailValue = hasEmail ? String(req.body.email || '').trim().toLowerCase() : null;
    if (hasEmail && !emailValue) {
        return res.status(400).json({ message: 'email cannot be empty' });
    }

    const phoneValue = hasPhone ? toNullableString(req.body.phone) : null;
    const departmentValue = hasDepartment ? toNullableString(req.body.department) : null;
    const joinDateValue = hasJoinDate ? toNullableString(req.body.joinDate) : null;
    const addressValue = hasAddress ? toNullableString(req.body.address) : null;
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
    const isActiveValue = hasIsActive
        ? ((req.body.is_active === true || req.body.is_active === 1 || String(req.body.is_active).toLowerCase() === 'true') ? 1 : 0)
        : null;

    let transaction;
    try {
        const pool = await poolPromise;

        const teacherRes = await pool.request()
            .input('teacher_id', sql.Int, teacherId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id, user_id FROM teachers WHERE id = @teacher_id AND school_id = @school_id');
        if (!teacherRes.recordset.length) {
            return res.status(404).json({ message: 'Teacher not found for this school' });
        }
        const userId = teacherRes.recordset[0].user_id;

        if (hasEmail) {
            const existingEmail = await pool.request()
                .input('email', sql.VarChar(255), emailValue)
                .input('user_id', sql.Int, userId)
                .query('SELECT id FROM users WHERE email = @email AND id <> @user_id');
            if (existingEmail.recordset.length) {
                return res.status(409).json({ message: 'Email already exists' });
            }
        }

        transaction = pool.transaction();
        await transaction.begin();

        await transaction.request()
            .input('user_id', sql.Int, userId)
            .input('has_name', sql.Bit, hasName ? 1 : 0)
            .input('name', sql.NVarChar(255), hasName ? nameValue : null)
            .input('has_email', sql.Bit, hasEmail ? 1 : 0)
            .input('email', sql.VarChar(255), hasEmail ? emailValue : null)
            .input('has_phone', sql.Bit, hasPhone ? 1 : 0)
            .input('phone', sql.VarChar(50), hasPhone ? phoneValue : null)
            .input('has_is_active', sql.Bit, hasIsActive ? 1 : 0)
            .input('is_active', sql.Bit, hasIsActive ? isActiveValue : null)
            .query(`
                UPDATE users
                SET name = CASE WHEN @has_name = 1 THEN @name ELSE name END,
                    email = CASE WHEN @has_email = 1 THEN @email ELSE email END,
                    phone = CASE WHEN @has_phone = 1 THEN @phone ELSE phone END,
                    is_active = CASE WHEN @has_is_active = 1 THEN @is_active ELSE is_active END,
                    updated_at = GETDATE()
                WHERE id = @user_id
            `);

        await transaction.request()
            .input('teacher_id', sql.Int, teacherId)
            .input('school_id', sql.Int, req.user.school_id)
            .input('has_department', sql.Bit, hasDepartment ? 1 : 0)
            .input('department', sql.NVarChar(100), hasDepartment ? departmentValue : null)
            .input('has_join_date', sql.Bit, hasJoinDate ? 1 : 0)
            .input('joinDate', sql.NVarChar(100), hasJoinDate ? joinDateValue : null)
            .input('has_address', sql.Bit, hasAddress ? 1 : 0)
            .input('address', sql.NVarChar(sql.MAX), hasAddress ? addressValue : null)
            .input('has_logo', sql.Bit, hasLogo ? 1 : 0)
            .input('logo', sql.NVarChar(sql.MAX), hasLogo ? logoValue : null)
            .query(`
                UPDATE teachers
                SET department = CASE WHEN @has_department = 1 THEN @department ELSE department END,
                    joinDate = CASE WHEN @has_join_date = 1 THEN @joinDate ELSE joinDate END,
                    address = CASE WHEN @has_address = 1 THEN @address ELSE address END,
                    logo = CASE WHEN @has_logo = 1 THEN @logo ELSE logo END
                WHERE id = @teacher_id AND school_id = @school_id
            `);

        await transaction.commit();
        res.json({ message: 'Teacher updated' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', audit('delete_teacher', 'teacher'), async (req, res) => {
    const teacherId = Number(req.params.id);
    if (!Number.isFinite(teacherId)) {
        return res.status(400).json({ message: 'Invalid teacher id' });
    }

    let transaction;
    try {
        const pool = await poolPromise;

        const teacherRes = await pool.request()
            .input('teacher_id', sql.Int, teacherId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('SELECT id, user_id FROM teachers WHERE id = @teacher_id AND school_id = @school_id');
        if (!teacherRes.recordset.length) {
            return res.status(404).json({ message: 'Teacher not found for this school' });
        }
        const userId = teacherRes.recordset[0].user_id;

        transaction = pool.transaction();
        await transaction.begin();

        // Deactivate the user account
        await transaction.request()
            .input('user_id', sql.Int, userId)
            .query(`UPDATE users SET is_active = 0, updated_at = GETDATE() WHERE id = @user_id`);

        // Remove the teacher record
        await transaction.request()
            .input('teacher_id', sql.Int, teacherId)
            .input('school_id', sql.Int, req.user.school_id)
            .query('DELETE FROM teachers WHERE id = @teacher_id AND school_id = @school_id');

        await transaction.commit();
        res.json({ message: 'Teacher deleted and account deactivated' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
