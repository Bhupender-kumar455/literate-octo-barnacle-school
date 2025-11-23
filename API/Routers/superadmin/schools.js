// routes/superadmin/schools.js
const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../../config/db');
const { protect, restrictTo } = require('../../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');


router.use(protect, restrictTo('superadmin'));
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const isValid = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
        if (isValid) cb(null, true);
        else cb(new Error('Only images allowed!'));
    }
});

// THE ROUTE
router.post('/logo', upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // This URL will work when you serve static files
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Onboard New School + Auto-create Principal
router.post('/onboard', async (req, res) => {
    const { school_name, address, principal_name, principal_email, principal_password, principal_mobile, logo } = req.body;

    console.log("All Data -> ", school_name, address, principal_name, principal_email, principal_password, principal_mobile, logo);

    let logoBase64 = null;
    if (logo) {
        try {
            const filePath = path.join(uploadDir, path.basename(logo));
            if (fs.existsSync(filePath)) {
                const fileBuffer = fs.readFileSync(filePath);
                // Get extension without dot, default to png if missing
                const ext = path.extname(logo).substring(1) || 'png';
                logoBase64 = `data:image/${ext};base64,${fileBuffer.toString('base64')}`;
            }
        } catch (error) {
            console.error("Error converting logo to base64:", error);
        }
    }

    let transaction;
    try {
        const pool = await poolPromise;
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const schoolRes = await transaction.request()
            .input('name', school_name)
            .input('address', address || null)
            .input('phone', principal_mobile || null)
            .input('logo', logoBase64)
            .input('created_by', 1)
            .query(`INSERT INTO schools (name, address, phone, logo, created_by) 
              OUTPUT INSERTED.id 
              VALUES (@name, @address, @phone, @logo, @created_by)`);

        const schoolId = schoolRes.recordset[0].id;
        const userRes = await transaction.request()
            .input('email', principal_email)
            .input('password_hash', principal_password)
            .input('name', principal_name)
            .input('phone', principal_mobile || null)
            .input('role', 'admin')
            .query(`INSERT INTO users (email, password_hash, name, phone, role, is_active) 
              OUTPUT INSERTED.id 
              VALUES (@email, @password_hash, @name, @phone, @role, 1)`);

        const principalId = userRes.recordset[0].id;

        // 4. Link principal to school
        await transaction.request()
            .input('user_id', principalId)
            .input('school_id', schoolId)
            .input('created_by', 1)
            .query(`INSERT INTO admins (user_id, school_id, created_by) VALUES (@user_id, @school_id, @created_by)`);

        await transaction.commit();

        res.json({
            message: "School onboarded successfully",
            principal: { email: principal_email, temporary_password: principal_password }
        });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('Onboard error:', err);
        res.status(500).json({ message: err.message || "Something went wrong" });
    }
});

// Impersonate (God Mode Login)
router.post('/impersonate/:schoolId', async (req, res) => {
    const { schoolId } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('school_id', schoolId)
            .query(`SELECT u.* FROM users u JOIN admins a ON u.id = a.user_id WHERE a.school_id = @school_id`);

        if (result.recordset.length === 0) return res.status(404).json({ message: "No admin found" });

        const admin = result.recordset[0];
        const token = jwt.sign(
            { id: admin.id, role: 'admin', school_id: schoolId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { ...admin, school_id: schoolId } });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get All Schools
router.get('/all', async (req, res) => {
    try {
        const pool = await poolPromise;
        let result = await pool.request()
            .execute('[dbo].[GETALLSCHOOL]');
        console.log(result.recordset);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
