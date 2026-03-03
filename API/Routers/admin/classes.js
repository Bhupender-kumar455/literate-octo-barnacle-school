const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

const ensureClassArchiveTable = async (pool) => {
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'class_archives')
        BEGIN
            CREATE TABLE class_archives (
                id BIGINT IDENTITY PRIMARY KEY,
                class_id BIGINT NOT NULL UNIQUE,
                school_id BIGINT NOT NULL,
                archived_by BIGINT NULL,
                reason NVARCHAR(255) NULL,
                archived_at DATETIME NOT NULL DEFAULT GETDATE(),
                FOREIGN KEY (class_id) REFERENCES classes(id),
                FOREIGN KEY (school_id) REFERENCES schools(id)
            );
        END
    `);
};

// Get all classes for this school
router.get('/', async (req, res) => {
    const includeArchived = String(req.query.include_archived || '').toLowerCase() === 'true';
    try {
        const pool = await poolPromise;
        await ensureClassArchiveTable(pool);
        const result = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('include_archived', sql.Bit, includeArchived ? 1 : 0)
            .query(`
                SELECT 
                    u.name AS teacher_name,
                    c.id,
                    c.school_id,
                    c.grade,
                    c.academic_year,
                    c.class_teacher_id,
                    c.section,
                    CASE WHEN ca.class_id IS NULL THEN 0 ELSE 1 END AS is_archived,
                    ca.archived_at
                FROM classes c
                LEFT JOIN teachers t ON t.id = c.class_teacher_id
                LEFT JOIN users u ON u.id = t.user_id
                LEFT JOIN class_archives ca
                    ON ca.class_id = c.id
                   AND ca.school_id = c.school_id
                WHERE c.school_id = @school_id
                  AND (@include_archived = 1 OR ca.class_id IS NULL)
                ORDER BY c.grade, c.section
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new class (e.g., 10-A)
router.post('/', audit('create_class', 'class'), async (req, res) => {
    const {
        grade,
        section,
        academic_year = '2025-2026',
        class_teacher_id,
    } = req.body;

    if (!grade || !section) {
        return res.status(400).json({ message: 'Grade and section are required' });
    }

    try {
        const pool = await poolPromise;
        const existing = await pool.request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('grade', sql.VarChar(50), String(grade))
            .input('section', sql.VarChar(50), String(section))
            .query('SELECT id FROM classes WHERE school_id = @school_id AND grade = @grade AND section = @section');
        if (existing.recordset.length) {
            return res.status(409).json({ message: 'Class already exists' });
        }

        const result = await pool
            .request()
            .input('school_id', sql.Int, req.user.school_id)
            .input('grade', sql.VarChar(50), String(grade))
            .input('section', sql.VarChar(50), String(section))
            .input('year', sql.VarChar(20), academic_year)
            .input('teacher', sql.Int, class_teacher_id || null)
            .execute('[dbo].[SP_CREATECLASS]');

        res.status(201).json({
            id: result.recordset[0].id,
            message: 'Class created'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Archive class (hide from active class lists, keep historical records)
router.patch('/:id/archive', audit('archive_class', 'class'), async (req, res) => {
    const classId = Number(req.params.id);
    const reason = req.body?.reason ? String(req.body.reason).trim() : null;

    if (!Number.isFinite(classId)) {
        return res.status(400).json({ message: 'Invalid class id' });
    }

    try {
        const pool = await poolPromise;
        await ensureClassArchiveTable(pool);

        const classRes = await pool.request()
            .input('class_id', sql.BigInt, classId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .query('SELECT id FROM classes WHERE id = @class_id AND school_id = @school_id');
        if (!classRes.recordset.length) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const dependencyRes = await pool.request()
            .input('class_id', sql.BigInt, classId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .query(`
                SELECT
                    (SELECT COUNT(1) FROM students WHERE class_id = @class_id AND school_id = @school_id) AS students_count,
                    (SELECT COUNT(1) FROM class_subjects WHERE class_id = @class_id) AS class_subjects_count
            `);
        const dependency = dependencyRes.recordset[0] || {};
        const studentsCount = Number(dependency.students_count || 0);

        if (studentsCount > 0) {
            return res.status(409).json({
                message: 'Cannot archive class with active students. Reassign students first.',
                dependencies: {
                    students: studentsCount,
                    class_subjects: Number(dependency.class_subjects_count || 0),
                },
            });
        }

        await pool.request()
            .input('class_id', sql.BigInt, classId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .input('archived_by', sql.BigInt, req.user.id || null)
            .input('reason', sql.NVarChar(255), reason)
            .query(`
                MERGE class_archives AS target
                USING (SELECT @class_id AS class_id, @school_id AS school_id) AS source
                ON target.class_id = source.class_id AND target.school_id = source.school_id
                WHEN MATCHED THEN
                    UPDATE SET archived_by = @archived_by, reason = @reason, archived_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (class_id, school_id, archived_by, reason, archived_at)
                    VALUES (@class_id, @school_id, @archived_by, @reason, GETDATE());
            `);

        res.json({ message: 'Class archived' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete class only when there are no linked students/subjects
router.delete('/:id', audit('delete_class', 'class'), async (req, res) => {
    const classId = Number(req.params.id);
    if (!Number.isFinite(classId)) {
        return res.status(400).json({ message: 'Invalid class id' });
    }

    try {
        const pool = await poolPromise;
        await ensureClassArchiveTable(pool);

        const classRes = await pool.request()
            .input('class_id', sql.BigInt, classId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .query('SELECT id FROM classes WHERE id = @class_id AND school_id = @school_id');
        if (!classRes.recordset.length) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const dependencyRes = await pool.request()
            .input('class_id', sql.BigInt, classId)
            .input('school_id', sql.BigInt, req.user.school_id)
            .query(`
                SELECT
                    (SELECT COUNT(1) FROM students WHERE class_id = @class_id AND school_id = @school_id) AS students_count,
                    (SELECT COUNT(1) FROM class_subjects WHERE class_id = @class_id) AS class_subjects_count
            `);

        const dependency = dependencyRes.recordset[0] || {};
        const dependencies = {
            students: Number(dependency.students_count || 0),
            class_subjects: Number(dependency.class_subjects_count || 0),
        };

        if (dependencies.students > 0 || dependencies.class_subjects > 0) {
            return res.status(409).json({
                message: 'Cannot delete class with linked students or class subjects',
                dependencies,
            });
        }

        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input('class_id', sql.BigInt, classId)
                .input('school_id', sql.BigInt, req.user.school_id)
                .query('DELETE FROM class_archives WHERE class_id = @class_id AND school_id = @school_id');

            await new sql.Request(tx)
                .input('class_id', sql.BigInt, classId)
                .input('school_id', sql.BigInt, req.user.school_id)
                .query('DELETE FROM classes WHERE id = @class_id AND school_id = @school_id');

            await tx.commit();
        } catch (txErr) {
            await tx.rollback();
            throw txErr;
        }

        res.json({ message: 'Class deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
