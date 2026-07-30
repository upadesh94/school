const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Storage for Firebase (Memory Storage) ────────────
const storage = multer.memoryStorage();


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
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: photoFilter
});

const uploadExcel = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: excelFilter
});

module.exports = { uploadPhoto, uploadExcel };
