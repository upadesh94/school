const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const { generateToken, verifyToken } = require('../utils/jwtHelper');
const {
  signInWithFirebaseAuth,
  getDemoPrincipalCredentials,
} = require('../utils/firebaseAuthService');

const isFirestorePermissionError = (error) => {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return error.code === 'permission-denied' || message.includes('insufficient permissions');
};

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

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, email, password, role } = req.body;
  const loginId = (username || email || '').trim();

  res.clearCookie('adminToken', { httpOnly: true, sameSite: 'strict' });
  res.clearCookie('teacherToken', { httpOnly: true, sameSite: 'strict' });

  try {
    if (role === 'admin') {
      const demoPrincipal = getDemoPrincipalCredentials();
      const normalizedLoginId = String(loginId || '').trim().toLowerCase();
      let admin = null;
      let profileStoreUnavailable = false;

      try {
        admin = await Admin.findOne({
          $or: [{ username: loginId }, { email: normalizedLoginId }],
        });
      } catch (lookupErr) {
        if (isFirestorePermissionError(lookupErr)) {
          profileStoreUnavailable = true;
          admin = null;
        } else {
          throw lookupErr;
        }
      }

      const adminEmail = normalizedLoginId.includes('@')
        ? normalizedLoginId
        : String(
          admin?.email ||
          (normalizedLoginId === demoPrincipal.username ? demoPrincipal.email : '')
        ).trim().toLowerCase();

      if (!adminEmail) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'admin', activeSession: null,
          error: '❌ चुकीचे Username किंवा Password', message: null
        });
      }

      const firebaseLogin = await signInWithFirebaseAuth(adminEmail, password);
      if (!firebaseLogin.ok && firebaseLogin.code !== 'FIREBASE_AUTH_NOT_CONFIGURED') {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'admin', activeSession: null,
          error: '❌ चुकीचे Username किंवा Password', message: null
        });
      }

      if (!admin && !firebaseLogin.ok) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'admin', activeSession: null,
          error: '❌ चुकीचे Username किंवा Password', message: null
        });
      }

      if (firebaseLogin.code === 'FIREBASE_AUTH_NOT_CONFIGURED') {
        if (!admin || !(await admin.comparePassword(password))) {
          return res.render('auth/login', {
            title: 'लॉगिन', role: 'admin', activeSession: null,
            error: '❌ चुकीचे Username किंवा Password', message: null
          });
        }
      }

      if (!admin) {
        if (adminEmail !== demoPrincipal.email) {
          return res.render('auth/login', {
            title: 'लॉगिन', role: 'admin', activeSession: null,
            error: '❌ Admin account not allowed for this email', message: null
          });
        }

        if (!profileStoreUnavailable) {
          try {
            admin = await Admin.create({
              username: demoPrincipal.username,
              email: demoPrincipal.email,
              password: demoPrincipal.password,
              name: demoPrincipal.displayName || 'Principal',
            });
          } catch (createErr) {
            if (isFirestorePermissionError(createErr)) {
              profileStoreUnavailable = true;
              admin = null;
            } else {
              throw createErr;
            }
          }
        }
      } else if (admin.email !== adminEmail) {
        admin.email = adminEmail;
      }

      // Bind token to this browser session (IP + User-Agent fingerprint)
      const tokenPayload = admin
        ? { id: admin._id, role: 'admin', name: admin.name, email: admin.email }
        : {
          id: firebaseLogin.localId || adminEmail,
          role: 'admin',
          name: demoPrincipal.displayName || 'Principal',
          email: adminEmail,
          firebaseAuth: true,
        };

      const token = generateToken(tokenPayload, req);

      if (admin) {
        admin.lastLogin = new Date();
        await admin.save({ validateBeforeSave: false });
      }

      res.cookie('adminToken', token, COOKIE_OPTS);
      return res.redirect('/admin/dashboard');

    } else if (role === 'teacher') {
      const teacher = await Teacher.findOne({ email: loginId });
      if (!teacher || !(await teacher.comparePassword(password))) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'teacher', activeSession: null,
          error: '❌ चुकीचा Email किंवा Password', message: null
        });
      }
      if (!teacher.isActive) {
        return res.render('auth/login', {
          title: 'लॉगिन', role: 'teacher', activeSession: null,
          error: '❌ आपले खाते निष्क्रिय आहे. Admin शी संपर्क करा.', message: null
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
