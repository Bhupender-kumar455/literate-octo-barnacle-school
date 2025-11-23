const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],  // ← Your React app URL
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const PORT = process.env.PORT || 5000;


app.use('/api/superadmin/schools', require('./Routers/superadmin/schools'));
app.use('/api/admin/announcements', require('./Routers/admin/announcements'));
app.use('/api/teacher/schedule', require('./Routers/teacher/schedule'));
app.use('/api/admin/fees', require('./Routers/admin/fees'));
app.use('/api/admin/classes', require('./Routers/admin/classes'));
app.use('/api/admin/students', require('./Routers/admin/students'));
app.use('/api/admin/teachers', require('./Routers/admin/teachers'));
app.use('/api/teacher/attendance', require('./Routers/teacher/attendance'));

app.use('/api/auth', require('./Routers/Login'));

app.use('/api/superadmin/schools', require('./Routers/superadmin/schools'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});