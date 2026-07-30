const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const { generateToken, verifyToken } = require('../utils/jwtHelper');
const { auth } = require('../config/db');
const { signInWithEmailAndPassword } = require('firebase/auth');
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000  // 8 hours
};

// GET /auth/login
router.get('/login', (req, res) => {
  // Clear invalid/expired cookies
  const adminToken = req.cookies?.adminToken;
  const teacherToken = req.cookies?.teacherToken;
  if (adminToken && !verifyToken(adminToken, req)) {
    res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
  }
  if (teacherToken && !verifyToken(teacherToken, req)) {
    res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.render('auth/login', {
    title: 'लॉगिन',
    error: req.query.error || null,
    message: req.query.msg || null,
    role: req.query.role || 'admin',
    activeSession: null
  });
});

// GET /auth/register-teacher
router.get('/register-teacher', (req, res) => {
  res.render('auth/register-teacher', {
    title: 'शिक्षक नोंदणी',
    error: null,
    message: null
  });
});

const { createUserWithEmailAndPassword } = require('firebase/auth');

// POST /auth/register-teacher
router.post('/register-teacher', async (req, res) => {
  try {
    const { name, email, phone, password, subject } = req.body;
    
    // Check if email already exists in Firestore
    const existing = await Teacher.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('auth/register-teacher', { title: 'शिक्षक नोंदणी', error: 'Email is already registered.', message: null });
    }
    
    // Create Firebase Auth user
    await createUserWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
    
    // Create Firestore document with isApproved: false
    await Teacher.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: password, // will be hashed by Teacher.preSave
      subject: subject ? subject.trim() : '',
      isActive: false, // Must be approved
      isApproved: false,
      role: 'teacher'
    });
    
    res.render('auth/register-teacher', {
      title: 'शिक्षक नोंदणी',
      error: null,
      message: 'नोंदणी यशस्वी झाली! मुख्याध्यापकांच्या मंजुरीची प्रतीक्षा करा. (Registration successful! Please wait for Principal approval.)'
    });
  } catch (err) {
    console.error('Teacher registration error:', err);
    res.render('auth/register-teacher', {
      title: 'शिक्षक नोंदणी',
      error: err.message,
      message: null
    });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, email, password, role } = req.body;
  const loginId = (username || email || '').trim();

  res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
  res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });

  try {
    if (role === 'admin') {
      try {
        let admin = await Admin.findOne({ email: loginId });
        if (!admin) {
          admin = await Admin.findOne({ username: loginId });
        }
        
        if (!admin) {
          return res.render('auth/login', {
            title: 'लॉगिन', role: 'admin', activeSession: null,
            error: '❌ खाते सापडले नाही. (Admin not found)', message: null
          });
        }

        const userCredential = await signInWithEmailAndPassword(auth, admin.email, password);
        const fbUser = userCredential.user;

        const token = generateToken({ id: admin._id, role: 'admin', name: admin.name }, req);
        res.cookie('adminToken', token, COOKIE_OPTS);
        return res.redirect('/admin/dashboard');
      } catch (err) {
        console.error('Firebase admin login error:', err.message);
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'admin', activeSession: null,
          error: '❌ चुकीचा Email/Username किंवा Password', message: null
        });
      }
    } else if (role === 'teacher') {
      const teacher = await Teacher.findOne({ email: loginId });
      if (!teacher || !(await teacher.comparePassword(password))) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'teacher', activeSession: null,
          error: '❌ चुकीचा Email किंवा Password', message: null
        });
      }
      if (!teacher.isActive || teacher.isApproved === false) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'teacher', activeSession: null,
          error: '❌ आपले खाते अद्याप मंजूर झालेले नाही. मुख्याध्यापकांशी संपर्क करा. (Pending Approval)', message: null
        });
      }
      // Bind token to this browser session (IP + User-Agent fingerprint)
      const token = generateToken({ id: teacher._id, role: 'teacher', name: teacher.name }, req);
      teacher.lastLogin = new Date();
      await teacher.save({ validateBeforeSave: false });
      res.cookie('teacherToken', token, COOKIE_OPTS);
      return res.redirect('/teacher/dashboard');
    }

    res.render('auth/login', {
      title: 'लॉगिन', role: 'admin', activeSession: null,
      error: 'Invalid role', message: null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', {
      title: 'लॉगिन', role: role || 'admin', activeSession: null,
      error: 'Server error. Try again.', message: null
    });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
  res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });
  if (req.session) req.session.destroy(() => {});
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.redirect('/auth/login?msg=यशस्वीरित्या बाहेर पडलात ✓');
});

module.exports = router;
