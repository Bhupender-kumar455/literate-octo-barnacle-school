// routes/auth.js  (or Login.js — whatever you named it)
const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    try {
        const pool = await poolPromise;
        const request = pool.request();

        request.input('email', sql.VarChar, email);
        request.input('role', sql.VarChar, role);
        request.input('password', sql.VarChar, password);

        const result = await request.query(`
      SELECT u.*, a.school_id 
      FROM users u 
      LEFT JOIN admins a ON u.id = a.user_id 
      WHERE u.email = @email AND u.role = @role AND u.is_active = 1 AND u.password_hash=@password
    `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "Invalid email, password or role" });
        }

        const user = result.recordset[0];
        // const validPassword = await bcrypt.compare(password, user.password_hash);
        // if (!validPassword) {
        //     return res.status(401).json({ message: "Invalid email, password or role" });
        // }

        const token = jwt.sign(
            { id: user.id, role: user.role, school_id: user.school_id || null },
            process.env.JWT_SECRET || 'my_super_strong_secret_2025',
            { expiresIn: '8h' }
        );

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
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;