const { verifyToken } = require('../utils/jwtHelper');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');

// ── Strong no-cache headers ──────────────────────────────────────
const noCache = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

// ── protectAdmin ─────────────────────────────────────────────────
const protectAdmin = async (req, res, next) => {
  try {
    noCache(res);
    const token = req.cookies?.adminToken;
    if (!token) {
      return res.redirect('/auth/login?msg=कृपया लॉगिन करा');
    }
    // Pass req for fingerprint verification
    const decoded = verifyToken(token, req);
    if (!decoded || decoded.role !== 'admin') {
      res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
      return res.redirect('/auth/login?msg=Session संपले किंवा अमान्य. पुन्हा लॉगिन करा.');
    }
    const admin = await Admin.findById(decoded.id);
    if (admin) delete admin.password;
    if (!admin) {
      res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
      return res.redirect('/auth/login?msg=खाते सापडले नाही.');
    }
    req.admin = admin;
    res.locals.admin = admin;
    res.locals.currentUser = admin;
    res.locals.userRole = 'admin';
    next();
  } catch (err) {
    res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
    res.redirect('/auth/login');
  }
};

// ── protectTeacher ───────────────────────────────────────────────
const protectTeacher = async (req, res, next) => {
  try {
    noCache(res);
    const token = req.cookies?.teacherToken;
    if (!token) {
      return res.redirect('/auth/login?msg=कृपया लॉगिन करा');
    }
    // Pass req for fingerprint verification (blocks same-URL paste in other browser/incognito)
    const decoded = verifyToken(token, req);
    if (!decoded || decoded.role !== 'teacher') {
      res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });
      return res.redirect('/auth/login?msg=Session संपले किंवा अमान्य. पुन्हा लॉगिन करा.');
    }
    const teacher = await Teacher.findById(decoded.id);
    if (teacher) delete teacher.password;
    if (!teacher || !teacher.isActive) {
      res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });
      return res.redirect('/auth/login?msg=खाते निष्क्रिय किंवा सापडले नाही.');
    }
    req.teacher = teacher;
    res.locals.teacher = teacher;
    res.locals.currentUser = teacher;
    res.locals.userRole = 'teacher';
    next();
  } catch (err) {
    res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });
    res.redirect('/auth/login');
  }
};

// ── redirectIfLoggedIn ────────────────────────────────────────────
const redirectIfLoggedIn = (req, res, next) => {
  next(); // Always show login — do not auto-redirect
};

module.exports = { protectAdmin, protectTeacher, redirectIfLoggedIn };
