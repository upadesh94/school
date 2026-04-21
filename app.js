require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const methodOverride = require('method-override');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const {
  ensureFirebaseAuthUser,
  getDemoPrincipalCredentials,
} = require('./utils/firebaseAuthService');

const app = express();
const isServerlessRuntime = Boolean(process.env.VERCEL);
const runtimeUploadRoot = isServerlessRuntime
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'public/uploads');

// ── Connect DB ─────────────────────────────────────────────────
connectDB();

// ── Ensure upload directories exist ────────────────────────────
const uploadDirs = [
  runtimeUploadRoot,
  path.join(runtimeUploadRoot, 'photos')
];
uploadDirs.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('📁 Created:', dir);
    }
  } catch (err) {
    console.warn(`⚠️ Upload directory unavailable (${dir}): ${err.message}`);
  }
});

// ── Seed Admin ─────────────────────────────────────────────────
const seedAdmin = async () => {
  const demoPrincipal = getDemoPrincipalCredentials();

  try {
    const firebaseSeed = await ensureFirebaseAuthUser(demoPrincipal);
    if (firebaseSeed.created) {
      console.log(`✅ Firebase Auth principal created → ${demoPrincipal.email} / ${demoPrincipal.password}`);
    } else {
      console.log(`ℹ️ Firebase Auth principal already exists → ${demoPrincipal.email}`);
    }
  } catch (err) {
    console.error('⚠️ Firebase Auth seed error:', err.message);
  }

  try {
    let adminProfile = await Admin.findOne({
      $or: [
        { username: demoPrincipal.username },
        { email: demoPrincipal.email },
      ],
    });

    if (!adminProfile) {
      adminProfile = await Admin.create({
        username: demoPrincipal.username,
        email: demoPrincipal.email,
        password: demoPrincipal.password,
        name: demoPrincipal.displayName || 'Principal',
      });
      console.log(`✅ Admin profile created → ${adminProfile.username} / ${demoPrincipal.email}`);
    } else if (adminProfile.email !== demoPrincipal.email) {
      adminProfile.email = demoPrincipal.email;
      await adminProfile.save();
      console.log(`ℹ️ Admin email synced to Firebase Auth → ${demoPrincipal.email}`);
    }
  } catch (err) {
    console.error('⚠️ Admin seed error:', err.message);
  }
};
if (!isServerlessRuntime && process.env.ENABLE_STARTUP_SEED !== 'false') {
  setTimeout(seedAdmin, 1500);
}

// ── View Engine ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Core Middleware ────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// ── SECURITY HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Static Files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(runtimeUploadRoot));

// ── Session (minimal — NOT used for auth tokens) ───────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'tuljabhavani_session_2024_secure',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,  // 8 hours
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// ── Global Template Locals ─────────────────────────────────────
app.use((req, res, next) => {
  res.locals.schoolNameMarathi = 'तुलजाभवानी माध्यमिक विद्यालय';
  res.locals.schoolNameEnglish = 'Tuljabhavani Madhyamik Vidyalay';
  res.locals.schoolAddress = 'वासुसायगाव, ता. गंगापूर';
  res.locals.success = req.query.success || null;
  res.locals.error_msg = req.query.error || null;
  next();
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/teacher', require('./routes/teacher'));

// Root → Login
app.get('/', (req, res) => res.redirect('/auth/login'));

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  try {
    res.status(404).render('404', { title: '404 – Page Not Found' });
  } catch (e) {
    res.status(404).send('<h2>404 - Page Not Found</h2><a href="/">Home</a>');
  }
});

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔴 Error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).send(`
    <div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;border:1px solid #fca5a5;border-radius:12px;background:#fff5f5;">
      <h2 style="color:#c62828;">⚠️ Server Error</h2>
      <p style="color:#555;">${err.message}</p>
      <a href="javascript:history.back()" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1a237e;color:#fff;border-radius:6px;text-decoration:none;">← Go Back</a>
    </div>
  `);
});

module.exports = app;

// ── Start Server (local only) ──────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const demoPrincipal = getDemoPrincipalCredentials();

  app.listen(PORT, () => {
    console.log(`\n🚀 तुलजाभवानी ERP → http://localhost:${PORT}`);
    console.log(`   Principal demo login: ${demoPrincipal.email} / ${demoPrincipal.password}\n`);
  });
}
