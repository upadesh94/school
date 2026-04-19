const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Ensure upload directories exist (absolute paths) ────────────
const photoDir = path.join(__dirname, '../public/uploads/photos');
const excelDir = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
if (!fs.existsSync(excelDir)) fs.mkdirSync(excelDir, { recursive: true });

// Photo storage
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo_${uuidv4()}${ext}`);
  }
});

// Excel storage
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, excelDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `excel_${uuidv4()}${ext}`);
  }
});

const photoFilter = (req, file, cb) => {
  const allowedExts = /\.(jpeg|jpg|png|webp|gif)$/i;
  const allowedMimes = /^image\/(jpeg|jpg|png|webp|gif)$/;
  if (allowedExts.test(file.originalname) && allowedMimes.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WebP) are allowed!'));
  }
};

const excelFilter = (req, file, cb) => {
  const allowedExts = /\.(xlsx|xls|csv)$/i;
  if (allowedExts.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed!'));
  }
};

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: photoFilter
});

const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: excelFilter
});

module.exports = { uploadPhoto, uploadExcel };
