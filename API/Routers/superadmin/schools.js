// routes/superadmin/schools.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { upload, convertFileToBase64, formatUploadError } = require('../../utils/fileHelper');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { audit } = require('../../middleware/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

router.use(protect, restrictTo('superadmin'));

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

// Onboard New School + Auto-create Principal
router.post('/onboard', audit('onboard_school', 'school'), async (req, res) => {
    const { school_name, address, principal_name, principal_email, principal_password, principal_mobile, logo } = req.body;

    if (!school_name || !principal_name || !principal_email) {
        return res.status(400).json({ message: 'School name, principal name, and principal email are required' });
    }

    const normalizedEmail = String(principal_email).trim().toLowerCase();
    const tempPassword = principal_password || 'Welcome123';
    const logoBase64 = convertFileToBase64(logo);

    let transaction;
    try {
        const pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const existingUser = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .query('SELECT id FROM users WHERE email = @email');
        if (existingUser.recordset.length) {
            await transaction.rollback();
            return res.status(409).json({ message: 'Principal email is already in use' });
        }

        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const schoolRes = await transaction.request()
            .input('name', sql.NVarChar(255), school_name)
            .input('address', sql.NVarChar(255), address || null)
            .input('phone', sql.NVarChar(50), principal_mobile || null)
            .input('logo', sql.NVarChar(sql.MAX), logoBase64)
            .input('created_by', sql.BigInt, req.user.id)
            .query(`INSERT INTO schools (name, address, phone, logo, created_by) 
              OUTPUT INSERTED.id 
              VALUES (@name, @address, @phone, @logo, @created_by)`);

        const schoolId = schoolRes.recordset[0].id;
        const userRes = await transaction.request()
            .input('email', sql.VarChar(255), normalizedEmail)
            .input('password_hash', sql.VarChar(255), hashedPassword)
            .input('name', sql.NVarChar(255), principal_name)
            .input('phone', sql.NVarChar(50), principal_mobile || null)
            .input('role', sql.VarChar(20), 'admin')
            .query(`INSERT INTO users (email, password_hash, name, phone, role, is_active) 
              OUTPUT INSERTED.id 
              VALUES (@email, @password_hash, @name, @phone, @role, 1)`);

        const principalId = userRes.recordset[0].id;
        await transaction.request()
            .input('user_id', sql.BigInt, principalId)
            .input('school_id', sql.BigInt, schoolId)
            .input('created_by', sql.BigInt, req.user.id)
            .query('INSERT INTO admins (user_id, school_id, created_by) VALUES (@user_id, @school_id, @created_by)');

        await transaction.commit();

        res.json({
            message: 'School onboarded successfully',
            principal: { email: normalizedEmail, temporary_password: tempPassword }
        });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Onboard error:', err);
        res.status(500).json({ message: err.message || 'Something went wrong' });
    }
});

// Impersonate Login
router.post('/impersonate/:schoolId', audit('impersonate_school', 'school'), async (req, res) => {
    const { schoolId } = req.params;
    const schoolIdNum = Number(schoolId);
    if (!Number.isFinite(schoolIdNum)) {
        return res.status(400).json({ message: 'Invalid school id' });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', sql.BigInt, schoolIdNum)
            .query(`
                SELECT u.id, u.email, u.role, u.name, u.phone, u.is_active
                FROM users u
                JOIN admins a ON u.id = a.user_id
                WHERE a.school_id = @school_id
            `);

        if (result.recordset.length === 0) return res.status(404).json({ message: 'No admin found' });

        const admin = result.recordset[0];
        const token = jwt.sign(
            { id: admin.id, role: 'admin', school_id: schoolIdNum },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { ...admin, school_id: schoolIdNum } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get All Schools
router.get('/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('[dbo].[GETALLSCHOOL]');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', audit('update_school', 'school'), async (req, res) => {
    const schoolId = Number(req.params.id);
    const {
        logo,
        school_name,
        phone,
        address,
        principal_name,
        principal_email,
        status,
        user_id,
        plan_type,
        storage_limit_gb
    } = req.body;

    if (!Number.isFinite(schoolId)) {
        return res.status(400).json({ message: 'Invalid school id' });
    }

    if (!school_name || !principal_name || !principal_email || !user_id) {
        return res.status(400).json({ message: 'School name, principal name, principal email, and user id are required' });
    }

    const logoBase64 = convertFileToBase64(logo);
    const normalizedEmail = String(principal_email).trim().toLowerCase();
    const isActive = Number(status) === 1 || status === true || String(status).toLowerCase() === 'active';

    let transaction;
    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();
        await transaction.request()
            .input('school_id', sql.Int, schoolId)
            .input('address', sql.NVarChar(255), address || null)
            .input('logo', sql.NVarChar(sql.MAX), logoBase64)
            .input('phone', sql.NVarChar(50), phone || null)
            .input('school_name', sql.NVarChar(255), school_name)
            .input('plan_type', sql.NVarChar(50), plan_type || null)
            .input('storage_limit_gb', sql.Int, storage_limit_gb || null)
            .input('user_id', sql.Int, user_id)
            .input('user_email', sql.NVarChar(255), normalizedEmail)
            .input('user_name', sql.NVarChar(255), principal_name)
            .input('user_phone', sql.NVarChar(50), phone || null)
            .input('is_active', sql.Int, isActive ? 1 : 0)
            .execute('UpdateSchoolAndUser');
        await transaction.commit();
        res.json({ message: 'School updated successfully' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
