// routes/auth.js (Login.js)
const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRole = String(role).trim().toLowerCase();
    if (!['superadmin', 'admin', 'teacher', 'student'].includes(normalizedRole)) {
        return res.status(400).json({ message: 'Invalid role' });
    }

    try {
        const pool = await poolPromise;
        const request = pool.request();

        request.input('email', sql.VarChar, normalizedEmail);
        request.input('role', sql.VarChar, normalizedRole);

        const result = await request.query(`
      SELECT 
        u.*,
        COALESCE(a.school_id, t.school_id, su.school_id) AS school_id,
        su.student_id
      FROM users u 
      LEFT JOIN admins a ON u.id = a.user_id 
      LEFT JOIN teachers t ON u.id = t.user_id
      LEFT JOIN student_users su ON u.id = su.user_id
      WHERE u.email = @email AND u.role = @role AND u.is_active = 1
    `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid email, password, or role' });
        }

        const user = result.recordset[0];
        let validPassword = false;
        try {
            validPassword = await bcrypt.compare(password, user.password_hash);
        } catch (err) {
            validPassword = false;
        }

        // Backward compatibility: some legacy rows stored plain text in password_hash.
        // If that matches, authenticate and upgrade immediately to bcrypt.
        if (!validPassword && user.password_hash === password) {
            validPassword = true;
            const upgradedHash = await bcrypt.hash(password, 10);
            await pool.request()
                .input('id', sql.BigInt, user.id)
                .input('password_hash', sql.VarChar(255), upgradedHash)
                .query('UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id');
        }
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid email, password, or role' });
        }

        const tokenPayload = { id: user.id, role: user.role, school_id: user.school_id || null };
        if (normalizedRole === 'student') tokenPayload.student_id = user.student_id || null;

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                school_id: user.school_id || null
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/me', protect, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT id, name, email, role FROM users WHERE id = @id');
        if (!result.recordset.length) return res.status(404).json({ message: 'User not found' });
        const user = result.recordset[0];

        let school_id = null;
        if (user.role === 'admin') {
            const adminRes = await pool.request()
                .input('user_id', sql.Int, user.id)
                .query('SELECT school_id FROM admins WHERE user_id = @user_id');
            school_id = adminRes.recordset[0]?.school_id || null;
        }
        if (user.role === 'teacher') {
            const teacherRes = await pool.request()
                .input('user_id', sql.Int, user.id)
                .query('SELECT school_id FROM teachers WHERE user_id = @user_id');
            school_id = teacherRes.recordset[0]?.school_id || null;
        }
        if (user.role === 'student') {
            const studentRes = await pool.request()
                .input('user_id', sql.Int, user.id)
                .query('SELECT school_id, student_id FROM student_users WHERE user_id = @user_id');
            school_id = studentRes.recordset[0]?.school_id || null;
            user.student_id = studentRes.recordset[0]?.student_id || null;
        }
        res.json({ user: { ...user, school_id } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
