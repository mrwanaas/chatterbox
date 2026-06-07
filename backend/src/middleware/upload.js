/**
 * Multer configuration for file uploads.
 * Handles avatar and attachment uploads with validation.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const UPLOAD_BASE = path.join(__dirname, '../../uploads');
ensureDir(path.join(UPLOAD_BASE, 'avatars'));
ensureDir(path.join(UPLOAD_BASE, 'attachments'));
ensureDir(path.join(UPLOAD_BASE, 'server-icons'));

// ─── Storage Engine ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'attachments';
    if (req.uploadType === 'avatar') folder = 'avatars';
    if (req.uploadType === 'server-icon') folder = 'server-icons';
    cb(null, path.join(UPLOAD_BASE, folder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ─── File Filter ───────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const attachmentTypes = /jpeg|jpg|png|gif|webp|pdf|txt|doc|docx|zip/;

  const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isImage = imageTypes.test(extname);
  const isAllowed = attachmentTypes.test(extname);

  if (req.uploadType === 'avatar' || req.uploadType === 'server-icon') {
    if (!isImage) return cb(new Error('Only image files are allowed for avatars'), false);
  } else {
    if (!isAllowed) return cb(new Error('File type not supported'), false);
  }

  cb(null, true);
};

// ─── Multer Instance ───────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
  },
});

// ─── Middleware Helpers ────────────────────────────────────────────────────────
const uploadAvatar = (req, res, next) => {
  req.uploadType = 'avatar';
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const uploadServerIcon = (req, res, next) => {
  req.uploadType = 'server-icon';
  upload.single('icon')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

const uploadAttachment = (req, res, next) => {
  req.uploadType = 'attachment';
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

/**
 * Build the public URL for an uploaded file.
 */
const getFileUrl = (req, filePath) => {
  const relativePath = filePath.replace(UPLOAD_BASE, '').replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/uploads${relativePath}`;
};

module.exports = { uploadAvatar, uploadServerIcon, uploadAttachment, getFileUrl };
