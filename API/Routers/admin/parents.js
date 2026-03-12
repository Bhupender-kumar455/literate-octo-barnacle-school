const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('admin'));

// GET all parents for this school
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);
        const result = await pool.request()
            .input('school_id', sql.BigInt, schoolId)
            .query(`
        SELECT
          p.id,
          p.user_id,
          p.phone,
          p.address,
          p.created_at,
          u.name,
          u.email,
          u.is_active,
          (
            SELECT COUNT(*)
            FROM parent_students ps
            WHERE ps.parent_id = p.id
          ) AS linked_students_count
        FROM parents p
        JOIN users u ON u.id = p.user_id
        WHERE p.school_id = @school_id
        ORDER BY u.name
      `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET single parent with their linked students
router.get('/:id', async (req, res) => {
    const parentId = Number(req.params.id);
    if (!Number.isFinite(parentId)) return res.status(400).json({ message: 'Invalid parent ID' });

    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);

        const parentResult = await pool.request()
            .input('id', sql.BigInt, parentId)
            .input('school_id', sql.BigInt, schoolId)
            .query(`
        SELECT p.id, p.user_id, p.phone, p.address, p.created_at,
               u.name, u.email, u.is_active
        FROM parents p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = @id AND p.school_id = @school_id
      `);

        if (!parentResult.recordset.length) {
            return res.status(404).json({ message: 'Parent not found' });
        }

        const linkedResult = await pool.request()
            .input('parent_id', sql.BigInt, parentId)
            .query(`
        SELECT s.id, s.name, s.admission_no, s.roll_number,
               c.grade, c.section, ps.relationship
        FROM parent_students ps
        JOIN students s ON ps.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        WHERE ps.parent_id = @parent_id
        ORDER BY s.name
      `);

        res.json({ ...parentResult.recordset[0], linked_students: linkedResult.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create parent account
router.post('/', async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'name, email and password are required' });
    }

    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();
        const normalizedPhone = phone || null;
        const normalizedAddress = address || null;

        const tx = new sql.Transaction(pool);
        await tx.begin();
        let rolledBack = false;
        try {
            // Check duplicate email inside transaction to avoid partial create races.
            const existing = await new sql.Request(tx)
                .input('email', sql.VarChar(255), normalizedEmail)
                .query(`SELECT id FROM users WHERE email = @email`);
            if (existing.recordset.length) {
                await tx.rollback();
                rolledBack = true;
                return res.status(409).json({ message: 'Email is already registered' });
            }

            const hash = await bcrypt.hash(password, 10);

            const userResult = await new sql.Request(tx)
                .input('email', sql.VarChar(255), normalizedEmail)
                .input('password_hash', sql.VarChar(255), hash)
                .input('role', sql.VarChar(20), 'parent')
                .input('name', sql.VarChar(255), normalizedName)
                .input('phone', sql.VarChar(50), normalizedPhone)
                .query(`
          INSERT INTO users (email, password_hash, role, name, phone)
          OUTPUT INSERTED.id
          VALUES (@email, @password_hash, @role, @name, @phone)
        `);

            const userId = userResult.recordset[0]?.id;
            if (!userId) throw new Error('Failed to create user account');

            const parentResult = await new sql.Request(tx)
                .input('user_id', sql.BigInt, userId)
                .input('school_id', sql.BigInt, schoolId)
                .input('phone', sql.VarChar(50), normalizedPhone)
                .input('address', sql.NVarChar(sql.MAX), normalizedAddress)
                .query(`
          INSERT INTO parents (user_id, school_id, phone, address)
          OUTPUT INSERTED.id
          VALUES (@user_id, @school_id, @phone, @address)
        `);

            const parentId = parentResult.recordset[0]?.id;
            if (!parentId) throw new Error('Failed to create parent profile');

            await tx.commit();
            res.status(201).json({
                id: parentId,
                user_id: userId,
                name: normalizedName,
                email: normalizedEmail,
                message: 'Parent created successfully'
            });
        } catch (txErr) {
            if (!rolledBack) {
                await tx.rollback();
            }
            throw txErr;
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update parent
router.put('/:id', async (req, res) => {
    const parentId = Number(req.params.id);
    if (!Number.isFinite(parentId)) return res.status(400).json({ message: 'Invalid parent ID' });

    const { name, phone, address, is_active } = req.body;
    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);

        const parentRow = await pool.request()
            .input('id', sql.BigInt, parentId)
            .input('school_id', sql.BigInt, schoolId)
            .query(`SELECT user_id FROM parents WHERE id = @id AND school_id = @school_id`);

        if (!parentRow.recordset.length) return res.status(404).json({ message: 'Parent not found' });
        const userId = parentRow.recordset[0].user_id;

        await pool.request()
            .input('user_id', sql.BigInt, userId)
            .input('name', sql.VarChar(255), name || null)
            .input('phone', sql.VarChar(50), phone || null)
            .input('is_active', sql.Bit, is_active === undefined ? null : (is_active ? 1 : 0))
            .query(`
        UPDATE users SET
          name = COALESCE(@name, name),
          phone = COALESCE(@phone, phone),
          is_active = COALESCE(@is_active, is_active),
          updated_at = GETDATE()
        WHERE id = @user_id
      `);

        await pool.request()
            .input('id', sql.BigInt, parentId)
            .input('phone', sql.VarChar(50), phone || null)
            .input('address', sql.NVarChar(sql.MAX), address || null)
            .query(`UPDATE parents SET phone = COALESCE(@phone, phone), address = COALESCE(@address, address) WHERE id = @id`);

        res.json({ message: 'Parent updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE parent
router.delete('/:id', async (req, res) => {
    const parentId = Number(req.params.id);
    if (!Number.isFinite(parentId)) return res.status(400).json({ message: 'Invalid parent ID' });

    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        let rolledBack = false;
        try {
            const parentRow = await new sql.Request(tx)
                .input('id', sql.BigInt, parentId)
                .input('school_id', sql.BigInt, schoolId)
                .query(`SELECT user_id FROM parents WHERE id = @id AND school_id = @school_id`);

            if (!parentRow.recordset.length) {
                await tx.rollback();
                rolledBack = true;
                return res.status(404).json({ message: 'Parent not found' });
            }
            const userId = parentRow.recordset[0].user_id;

            const chatUsage = await new sql.Request(tx)
                .input('school_id', sql.BigInt, schoolId)
                .input('user_id', sql.BigInt, userId)
                .query(`
          SELECT
            (SELECT COUNT(1) FROM chat_conversations WHERE school_id = @school_id AND parent_user_id = @user_id) AS conversations_count,
            (SELECT COUNT(1) FROM chat_messages WHERE school_id = @school_id AND sender_user_id = @user_id) AS messages_count
        `);
            const usage = chatUsage.recordset[0] || {};
            const conversationsCount = Number(usage.conversations_count || 0);
            const messagesCount = Number(usage.messages_count || 0);
            if (conversationsCount > 0 || messagesCount > 0) {
                await tx.rollback();
                rolledBack = true;
                return res.status(409).json({
                    message: 'Cannot delete parent with existing chat history. Deactivate the account instead.'
                });
            }

            // Deleting user cascades to parents and parent_students.
            await new sql.Request(tx)
                .input('user_id', sql.BigInt, userId)
                .query(`DELETE FROM users WHERE id = @user_id`);

            await tx.commit();
            res.json({ message: 'Parent deleted' });
        } catch (txErr) {
            if (!rolledBack) {
                await tx.rollback();
            }
            throw txErr;
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST link a student to a parent
router.post('/:id/link-student', async (req, res) => {
    const parentId = Number(req.params.id);
    const studentId = Number(req.body.student_id);
    const relationship = String(req.body.relationship || 'guardian');

    if (!Number.isFinite(parentId) || !Number.isFinite(studentId)) {
        return res.status(400).json({ message: 'Invalid parent_id or student_id' });
    }

    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);

        // Verify parent belongs to school
        const parentRow = await pool.request()
            .input('id', sql.BigInt, parentId)
            .input('school_id', sql.BigInt, schoolId)
            .query(`SELECT id FROM parents WHERE id = @id AND school_id = @school_id`);
        if (!parentRow.recordset.length) return res.status(404).json({ message: 'Parent not found' });

        // Verify student belongs to school
        const studentRow = await pool.request()
            .input('id', sql.BigInt, studentId)
            .input('school_id', sql.BigInt, schoolId)
            .query(`SELECT id FROM students WHERE id = @id AND school_id = @school_id`);
        if (!studentRow.recordset.length) return res.status(404).json({ message: 'Student not found' });

        // Check already linked
        const existing = await pool.request()
            .input('parent_id', sql.BigInt, parentId)
            .input('student_id', sql.BigInt, studentId)
            .query(`SELECT id FROM parent_students WHERE parent_id = @parent_id AND student_id = @student_id`);
        if (existing.recordset.length) return res.status(409).json({ message: 'Student already linked to this parent' });

        await pool.request()
            .input('parent_id', sql.BigInt, parentId)
            .input('student_id', sql.BigInt, studentId)
            .input('relationship', sql.VarChar(50), relationship)
            .query(`INSERT INTO parent_students (parent_id, student_id, relationship) VALUES (@parent_id, @student_id, @relationship)`);

        res.status(201).json({ message: 'Student linked successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE unlink a student from a parent
router.delete('/:id/unlink-student/:studentId', async (req, res) => {
    const parentId = Number(req.params.id);
    const studentId = Number(req.params.studentId);

    try {
        const pool = await poolPromise;
        const schoolId = Number(req.user.school_id);

        const parentRow = await pool.request()
            .input('id', sql.BigInt, parentId)
            .input('school_id', sql.BigInt, schoolId)
            .query(`SELECT id FROM parents WHERE id = @id AND school_id = @school_id`);
        if (!parentRow.recordset.length) return res.status(404).json({ message: 'Parent not found' });

        await pool.request()
            .input('parent_id', sql.BigInt, parentId)
            .input('student_id', sql.BigInt, studentId)
            .query(`DELETE FROM parent_students WHERE parent_id = @parent_id AND student_id = @student_id`);

        res.json({ message: 'Student unlinked' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
