const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
const { poolPromise, sql } = require('../../config/db');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('teacher'));

const normalizeStatus = (status) => {
    if (status === undefined || status === null) return null;
    const normalized = String(status).toLowerCase();
    const allowed = ['present', 'absent', 'late', 'half_day'];
    return allowed.includes(normalized) ? normalized : null;
};

const parseOptionalId = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
};

const getTeacherContext = async (pool, userId) => {
    const teacherRes = await pool.request()
        .input('user_id', sql.BigInt, userId)
        .query('SELECT id, school_id FROM teachers WHERE user_id = @user_id');
    if (!teacherRes.recordset.length) return null;
    return {
        teacherId: Number(teacherRes.recordset[0].id),
        schoolId: Number(teacherRes.recordset[0].school_id)
    };
};

const isStudentInSchool = async (pool, studentId, schoolId) => {
    const studentRes = await pool.request()
        .input('student_id', sql.BigInt, studentId)
        .input('school_id', sql.BigInt, schoolId)
        .query('SELECT 1 AS ok FROM students WHERE id = @student_id AND school_id = @school_id');
    return studentRes.recordset.length > 0;
};

const isClassSubjectForTeacher = async (pool, classSubjectId, teacherId) => {
    if (!classSubjectId) return true;
    const classSubjectRes = await pool.request()
        .input('class_subject_id', sql.BigInt, classSubjectId)
        .input('teacher_id', sql.BigInt, teacherId)
        .query('SELECT 1 AS ok FROM class_subjects WHERE id = @class_subject_id AND teacher_id = @teacher_id');
    return classSubjectRes.recordset.length > 0;
};

router.get('/my-classes-today', async (req, res) => {
    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) return res.json([]);

        const result = await pool.request()
            .input('teacher_id', sql.BigInt, teacherContext.teacherId)
            .query(`
        SELECT cs.*, c.grade, c.section, s.name as subject_name
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        JOIN subjects s ON cs.subject_id = s.id
        WHERE cs.teacher_id = @teacher_id
      `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark attendance
router.post('/mark', audit('mark_attendance', 'attendance'), async (req, res) => {
    const { student_id, date, status, class_subject_id, remarks } = req.body;
    const normalizedStatus = normalizeStatus(status);
    const studentId = parseOptionalId(student_id);
    const classSubjectId = parseOptionalId(class_subject_id);

    if (!studentId || !date || !normalizedStatus) {
        return res.status(400).json({ message: 'student_id, date, and valid status are required' });
    }

    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) {
            return res.status(400).json({ message: 'Teacher not found' });
        }

        const validStudent = await isStudentInSchool(pool, studentId, teacherContext.schoolId);
        if (!validStudent) {
            return res.status(400).json({ message: 'Invalid student for this teacher' });
        }

        const validClassSubject = await isClassSubjectForTeacher(pool, classSubjectId, teacherContext.teacherId);
        if (!validClassSubject) {
            return res.status(400).json({ message: 'Invalid class subject for this teacher' });
        }

        await pool.request()
            .input('student_id', sql.BigInt, studentId)
            .input('date', sql.Date, date)
            .input('status', sql.VarChar(20), normalizedStatus)
            .input('class_subject_id', sql.BigInt, classSubjectId)
            .input('marked_by', sql.BigInt, teacherContext.teacherId)
            .input('remarks', sql.NVarChar(sql.MAX), remarks || null)
            .query(`
        IF EXISTS (
          SELECT 1 FROM attendance
          WHERE student_id = @student_id
            AND [date] = @date
            AND ((class_subject_id IS NULL AND @class_subject_id IS NULL)
              OR (class_subject_id = @class_subject_id))
        )
        BEGIN
          UPDATE attendance
          SET status = @status, marked_by = @marked_by, remarks = @remarks, marked_at = GETDATE()
          WHERE student_id = @student_id
            AND [date] = @date
            AND ((class_subject_id IS NULL AND @class_subject_id IS NULL)
              OR (class_subject_id = @class_subject_id))
        END
        ELSE
        BEGIN
          INSERT INTO attendance (student_id, [date], status, class_subject_id, marked_by, remarks)
          VALUES (@student_id, @date, @status, @class_subject_id, @marked_by, @remarks)
        END
      `);
        res.json({ message: 'Attendance marked' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/bulk', audit('mark_attendance_bulk', 'attendance'), async (req, res) => {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: 'Date and records are required' });
    }

    const parsedRecords = records.map((rec) => ({
        student_id: parseOptionalId(rec.student_id),
        status: normalizeStatus(rec.status),
        class_subject_id: parseOptionalId(rec.class_subject_id),
        remarks: rec.remarks || null
    }));

    for (let i = 0; i < parsedRecords.length; i += 1) {
        const rec = parsedRecords[i];
        if (!rec.student_id || !rec.status) {
            return res.status(400).json({ message: `Invalid record at index ${i}. Each record must include student_id and a valid status` });
        }
    }

    let transaction;
    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) {
            return res.status(400).json({ message: 'Teacher not found' });
        }

        const studentValidationCache = new Map();
        const classSubjectValidationCache = new Map();
        for (const rec of parsedRecords) {
            if (!studentValidationCache.has(rec.student_id)) {
                const studentOk = await isStudentInSchool(pool, rec.student_id, teacherContext.schoolId);
                studentValidationCache.set(rec.student_id, studentOk);
            }
            if (!studentValidationCache.get(rec.student_id)) {
                return res.status(400).json({ message: `Student ${rec.student_id} is not valid for this teacher` });
            }

            if (rec.class_subject_id && !classSubjectValidationCache.has(rec.class_subject_id)) {
                const classSubjectOk = await isClassSubjectForTeacher(pool, rec.class_subject_id, teacherContext.teacherId);
                classSubjectValidationCache.set(rec.class_subject_id, classSubjectOk);
            }
            if (rec.class_subject_id && !classSubjectValidationCache.get(rec.class_subject_id)) {
                return res.status(400).json({ message: `Class subject ${rec.class_subject_id} is not assigned to this teacher` });
            }
        }

        transaction = pool.transaction();
        await transaction.begin();

        for (const rec of parsedRecords) {
            await transaction.request()
                .input('student_id', sql.BigInt, rec.student_id)
                .input('date', sql.Date, date)
                .input('status', sql.VarChar(20), rec.status)
                .input('class_subject_id', sql.BigInt, rec.class_subject_id)
                .input('marked_by', sql.BigInt, teacherContext.teacherId)
                .input('remarks', sql.NVarChar(sql.MAX), rec.remarks)
                .query(`
                    IF EXISTS (
                      SELECT 1 FROM attendance
                      WHERE student_id = @student_id
                        AND [date] = @date
                        AND ((class_subject_id IS NULL AND @class_subject_id IS NULL)
                          OR (class_subject_id = @class_subject_id))
                    )
                    BEGIN
                      UPDATE attendance
                      SET status = @status, marked_by = @marked_by, remarks = @remarks, marked_at = GETDATE()
                      WHERE student_id = @student_id
                        AND [date] = @date
                        AND ((class_subject_id IS NULL AND @class_subject_id IS NULL)
                          OR (class_subject_id = @class_subject_id))
                    END
                    ELSE
                    BEGIN
                      INSERT INTO attendance (student_id, [date], status, class_subject_id, marked_by, remarks)
                      VALUES (@student_id, @date, @status, @class_subject_id, @marked_by, @remarks)
                    END
                `);
        }

        await transaction.commit();
        res.json({ message: 'Attendance submitted' });
    } catch (err) {
        if (transaction) await transaction.rollback();
        res.status(500).json({ message: err.message });
    }
});

router.get('/history', async (req, res) => {
    const { from, to } = req.query;
    try {
        const pool = await poolPromise;
        const teacherContext = await getTeacherContext(pool, req.user.id);
        if (!teacherContext) return res.json([]);

        const result = await pool.request()
            .input('teacher_id', sql.BigInt, teacherContext.teacherId)
            .input('from', sql.Date, from || null)
            .input('to', sql.Date, to || null)
            .query(`
                SELECT 
                  a.id,
                  a.student_id,
                  s.name as student_name,
                  s.roll_number,
                  a.status,
                  a.[date],
                  a.remarks,
                  c.grade,
                  c.section,
                  subj.name as subject
                FROM attendance a
                JOIN students s ON a.student_id = s.id
                LEFT JOIN class_subjects cs ON a.class_subject_id = cs.id
                LEFT JOIN classes c ON cs.class_id = c.id
                LEFT JOIN subjects subj ON cs.subject_id = subj.id
                WHERE a.marked_by = @teacher_id
                  AND (@from IS NULL OR a.[date] >= @from)
                  AND (@to IS NULL OR a.[date] <= @to)
                ORDER BY a.[date] DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
