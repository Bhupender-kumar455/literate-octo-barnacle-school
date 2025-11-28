const express = require('express');
const router = express.Router();
const { upload, convertFileToBase64 } = require('../../utils/fileHelper');
const { poolPromise } = require('../../config/db');
// const bcrypt = require('bcryptjs');
var crypto = require('crypto');

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', req.query.school_id || req.user.school_id)
            .query(`
        SELECT t.*, u.name, u.email, u.phone, u.is_active, t.department, t.employee_id
        FROM teachers t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.school_id = @school_id
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/logo', upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

router.post('/', async (req, res) => {
    const { name, email, password, department, logo, phone, status, address, joinDate } = req.body;
    let logoBase64 = convertFileToBase64(logo);
    const randomString1 = crypto.randomBytes(4).toString('hex');


    let transaction;
    try {
        const pool = await poolPromise;
        // const hashed = await bcrypt.hash(password || 'Welcome123', 10); // Default password if not provided

        transaction = pool.transaction();
        await transaction.begin();

        const userResult = await transaction.request()
            .input('email', email)
            .input('password_hash', password)
            .input('name', name)
            .input('role', 'teacher')
            .input('phone', phone || null)
            .input('is_active', status === 'Active' ? 1 : 0)
            .query(`INSERT INTO users (email, password_hash, name, role, phone, is_active) OUTPUT INSERTED.id VALUES (@email, @password_hash, @name, @role, @phone, @is_active)`);
        const userId = userResult.recordset[0].id;

        await transaction.request()
            .input('user_id', userId)
            .input('school_id', req.body.school_id || req.user.school_id)
            .input('employee_id', randomString1 || null)
            .input('department', department)
            .input('logo', logoBase64 || '')
            .input('address', address)
            .input('joinDate', joinDate)
            .input('created_by', req.body.school_id || req.user.school_id)
            .query(`INSERT INTO teachers (user_id, school_id, employee_id, department, logo, created_by,joinDate,address) VALUES (@user_id, @school_id, @employee_id, @department, @logo, @created_by,@joinDate,@address)`);
        await transaction.commit();
        res.status(201).json({ message: "Teacher created with login!" });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;