const express = require('express');
const router = express.Router();
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', req.user.school_id)
            .query(`
        SELECT t.*, u.name, u.email 
        FROM teachers t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.school_id = @school_id
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    const { name, email, password, employee_id, department } = req.body;
    try {
        const pool = await poolPromise;
        const hashed = await bcrypt.hash(password, 10);

        const transaction = pool.transaction();
        await transaction.begin();

        const userResult = await transaction.request()
            .input('email', email)
            .input('password_hash', hashed)
            .input('name', name)
            .input('role', 'teacher')
            .query(`INSERT INTO users (email, password_hash, name, role) OUTPUT INSERTED.id VALUES (@email, @password_hash, @name, @role)`);

        const userId = userResult.recordset[0].id;

        await transaction.request()
            .input('user_id', userId)
            .input('school_id', req.user.school_id)
            .input('employee_id', employee_id)
            .input('department', department)
            .query(`INSERT INTO teachers (user_id, school_id, employee_id, department) VALUES (@user_id, @school_id, @employee_id, @department)`);

        await transaction.commit();
        res.status(201).json({ message: "Teacher created with login!" });
    } catch (err) {
        await transaction?.rollback();
        res.status(500).json({ message: err.message });
    }
});
module.exports = router;