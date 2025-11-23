const express = require('express');
const router = express.Router();
const { poolPromise } = require('../../config/db');

router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', req.user.school_id)
            .query(`
        SELECT s.*, c.grade + '-' + c.section AS class_name
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.school_id = @school_id
        ORDER BY c.grade, c.section, s.roll_number
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    const { class_id, admission_no, roll_number, name, gender, dob, guardian_name, guardian_phone } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('school_id', req.user.school_id)
            .input('class_id', class_id)
            .input('admission_no', admission_no)
            .input('roll_number', roll_number)
            .input('name', name)
            .input('gender', gender)
            .input('dob', dob)
            .input('guardian_name', guardian_name)
            .input('guardian_phone', guardian_phone)
            .query(`
        INSERT INTO students (school_id, class_id, admission_no, roll_number, name, gender, dob, guardian_name, guardian_phone)
        VALUES (@school_id, @class_id, @admission_no, @roll_number, @name, @gender, @dob, @guardian_name, @guardian_phone)
      `);
        res.status(201).json({ message: "Student added!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;