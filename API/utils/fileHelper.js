const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedImageExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.avif',
    '.heic',
    '.heif',
    '.jfif'
]);

const mimeByExtension = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.jfif': 'image/jpeg'
};

const getMimeByExtension = (ext) => mimeByExtension[ext] || 'application/octet-stream';

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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isImageMime = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');
        const isValidExtension = allowedImageExtensions.has(ext);
        const isValid = isImageMime && isValidExtension;
        if (isValid) cb(null, true);
        else cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, svg, avif, heic, heif, jfif)'));
    }
});

const formatUploadError = (error) => {
    if (!error) return 'Upload failed';
    if (error.code === 'LIMIT_FILE_SIZE') {
        return 'File too large. Maximum allowed size is 10MB';
    }
    return error.message || 'Upload failed';
};

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
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = getMimeByExtension(ext);
            return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        }
    } catch (error) {
        console.error("Error converting file to base64:", error);
    }
    return null;
};

module.exports = { upload, convertFileToBase64, uploadDir, formatUploadError };
