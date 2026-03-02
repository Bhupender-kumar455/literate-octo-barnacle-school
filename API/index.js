const express = require('express');
const cors = require('cors');
const path = require('path');
const { startNotificationWorker, stopNotificationWorker } = require('./services/notificationWorker');
const fs = require('fs');
require('./config/env');

const app = express();

app.disable('x-powered-by');

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:4173'
];
const allowedOrigins = (process.env.CORS_ORIGIN || defaultOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({
  limit: '5mb',
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/billing/webhook') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const pool = await require('./config/db').poolPromise;
    await pool.request().query('SELECT 1 AS ok');
    res.json({ ok: true, db: 'up' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

// app.use('/api/admin/students', require('./routes/admin/students-bulk'));
app.use('/api/superadmin/schools', require('./Routers/superadmin/schools'));
app.use('/api/admin/announcements', require('./Routers/admin/announcements'));
app.use('/api/teacher/schedule', require('./Routers/teacher/schedule'));
app.use('/api/admin/fees', require('./Routers/admin/fees'));
app.use('/api/admin/reports', require('./Routers/admin/reports'));
app.use('/api/admin/report-cards', require('./Routers/admin/report-cards'));
app.use('/api/admin/grades', require('./Routers/admin/grades'));
app.use('/api/admin/classes', require('./Routers/admin/classes'));
app.use('/api/admin/subjects', require('./Routers/admin/subjects'));
app.use('/api/admin/class-subjects', require('./Routers/admin/class-subjects'));
app.use('/api/admin/schedule', require('./Routers/admin/schedule'));
app.use('/api/admin/students', require('./Routers/admin/students'));
app.use('/api/admin/students-bulk', require('./Routers/admin/students-bulk'));
app.use('/api/admin/teachers', require('./Routers/admin/teachers'));
app.use('/api/admin/notifications', require('./Routers/admin/notifications'));
app.use('/api/admin/leaves', require('./Routers/admin/leaves'));
app.use('/api/teacher/attendance', require('./Routers/teacher/attendance'));
app.use('/api/admin/stats', require('./Routers/admin/stats'));
app.use('/api/superadmin/stats', require('./Routers/superadmin/stats'));
app.use('/api/teacher/students', require('./Routers/teacher/students'));
app.use('/api/teacher/grades', require('./Routers/teacher/grades'));
app.use('/api/teacher/assignments', require('./Routers/teacher/assignments'));
app.use('/api/teacher/leaves', require('./Routers/teacher/leaves'));
app.use('/api/billing', require('./Routers/billing/stripe'));
app.use('/api/superadmin/users', require('./Routers/superadmin/users'));
app.use('/api/superadmin/audit', require('./Routers/superadmin/audit'));

app.use('/api/student/portal', require('./Routers/student/portal'));
app.use('/api/auth', require('./Routers/Login'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  startNotificationWorker();
});

const shutdown = () => {
  stopNotificationWorker();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
