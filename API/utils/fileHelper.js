const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Multer Upload Instance
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

/**
 * Converts a file from the uploads directory to a Base64 string.
 * @param {string} filename - The name of the file in the uploads directory.
 * @returns {string|null} - The Base64 string or null if file not found/error.
 */
const convertFileToBase64 = (filename) => {
    if (!filename) return null;
    try {
        const filePath = path.join(uploadDir, path.basename(filename));
        if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            const ext = path.extname(filename).substring(1) || 'png';
            return `data:image/${ext};base64,${fileBuffer.toString('base64')}`;
        }
    } catch (error) {
        console.error("Error converting file to base64:", error);
    }
    return null;
};

module.exports = { upload, convertFileToBase64, uploadDir };
