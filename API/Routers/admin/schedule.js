const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const { audit } = require('../../middleware/audit');

router.use(protect, restrictTo('admin'));

const normalizeTime = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const hhmmss = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

  if (hhmmss.test(trimmed)) return trimmed;
  if (hhmm.test(trimmed)) return `${trimmed}:00`;
  return null;
};

router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT csched.*, c.grade, c.section, subj.name as subject, u.name as teacher_name
        FROM class_schedule csched
        JOIN class_subjects cs ON csched.class_subject_id = cs.id
        JOIN classes c ON cs.class_id = c.id
        JOIN subjects subj ON cs.subject_id = subj.id
        JOIN teachers t ON cs.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        WHERE c.school_id = @school_id
        ORDER BY csched.day_of_week, csched.start_time
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', audit('create_schedule', 'class_schedule'), async (req, res) => {
  const { class_subject_id, day_of_week, start_time, end_time, room } = req.body;
  if (!class_subject_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ message: 'class_subject_id, day_of_week, start_time, and end_time are required' });
  }

  const normalizedStartTime = normalizeTime(start_time);
  const normalizedEndTime = normalizeTime(end_time);
  if (!normalizedStartTime || !normalizedEndTime) {
    return res.status(400).json({ message: 'Invalid time format. Use HH:mm or HH:mm:ss' });
  }

  try {
    const pool = await poolPromise;

    const validRes = await pool.request()
      .input('class_subject_id', sql.Int, class_subject_id)
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        SELECT cs.id
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        WHERE cs.id = @class_subject_id AND c.school_id = @school_id
      `);
    if (!validRes.recordset.length) {
      return res.status(400).json({ message: 'Invalid class_subject_id for this school' });
    }

    const result = await pool.request()
      .input('class_subject_id', sql.Int, class_subject_id)
      .input('day_of_week', sql.VarChar(20), day_of_week)
      .input('start_time', sql.VarChar(8), normalizedStartTime)
      .input('end_time', sql.VarChar(8), normalizedEndTime)
      .input('room', sql.VarChar(50), room || null)
      .query(`
        INSERT INTO class_schedule (class_subject_id, day_of_week, start_time, end_time, room)
        OUTPUT INSERTED.id
        VALUES (@class_subject_id, @day_of_week, TRY_CONVERT(time, @start_time), TRY_CONVERT(time, @end_time), @room)
      `);
    res.status(201).json({ id: result.recordset[0].id, message: 'Schedule created' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', audit('delete_schedule', 'class_schedule'), async (req, res) => {
  const scheduleId = Number(req.params.id);
  if (!Number.isFinite(scheduleId)) {
    return res.status(400).json({ message: 'Invalid schedule id' });
  }
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, scheduleId)
      .input('school_id', sql.Int, req.user.school_id)
      .query(`
        DELETE cs
        FROM class_schedule cs
        JOIN class_subjects csub ON cs.class_subject_id = csub.id
        JOIN classes c ON csub.class_id = c.id
        WHERE cs.id = @id AND c.school_id = @school_id
      `);

    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
