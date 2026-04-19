const express = require('express');
const router = express.Router();
const path = require('path');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const ActivityLog = require('../models/ActivityLog');
const { protectAdmin } = require('../middleware/auth');
const { uploadPhoto } = require('../middleware/upload');
const { sendEmail, teacherWelcomeEmail, teacherUpdateEmail, teacherPasswordResetEmail } = require('../utils/mailer');

router.use(protectAdmin);

// ─── DASHBOARD ──────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [totalTeachers, activeTeachers, totalStudents, recentActivities, classWiseCount] = await Promise.all([
      Teacher.countDocuments(),
      Teacher.countDocuments({ isActive: true }),
      Student.countDocuments(),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10),
      Student.aggregate([
        { $group: { _id: { class: '$currentClass', section: '$currentSection' }, count: { $sum: 1 } } },
        { $sort: { '_id.class': 1 } }
      ])
    ]);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard', admin: req.admin,
      stats: { totalTeachers, activeTeachers, totalStudents },
      recentActivities, classWiseCount
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('admin/dashboard', {
      title: 'Dashboard', admin: req.admin,
      stats: { totalTeachers: 0, activeTeachers: 0, totalStudents: 0 },
      recentActivities: [], classWiseCount: []
    });
  }
});

// ─── TEACHERS LIST ──────────────────────────────────────────────
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
    res.render('admin/teachers', {
      title: 'Manage Teachers', admin: req.admin, teachers,
      success: req.query.success || null, error: req.query.error || null
    });
  } catch (err) {
    res.render('admin/teachers', { title: 'Manage Teachers', admin: req.admin, teachers: [], success: null, error: err.message });
  }
});

// ─── ADD TEACHER FORM ───────────────────────────────────────────
router.get('/teachers/add', (req, res) => {
  res.render('admin/teacher-form', { title: 'Add Teacher', admin: req.admin, teacher: null, error: null });
});

// ─── ADD TEACHER POST ───────────────────────────────────────────
router.post('/teachers/add', (req, res, next) => {
  uploadPhoto.single('profilePhoto')(req, res, (err) => {
    if (err) {
      return res.render('admin/teacher-form', {
        title: 'Add Teacher', admin: req.admin, teacher: null,
        error: 'Photo upload error: ' + err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { name, email, phone, qualification, subject, classAssigned, section, address, gender, dateOfBirth, joiningDate } = req.body;

    if (!name || !email) {
      return res.render('admin/teacher-form', {
        title: 'Add Teacher', admin: req.admin, teacher: null, error: 'Name and Email are required'
      });
    }

    // Check duplicate
    const existing = await Teacher.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('admin/teacher-form', {
        title: 'Add Teacher', admin: req.admin, teacher: null, error: 'A teacher with this email already exists'
      });
    }

    const rawPassword = `Teacher@${Math.floor(1000 + Math.random() * 9000)}`;
    const teacher = new Teacher({
      name: name.trim(), email: email.toLowerCase().trim(), phone, qualification,
      subject, classAssigned, section, address, gender, dateOfBirth, joiningDate,
      password: rawPassword,
      profilePhoto: req.file ? `/uploads/photos/${req.file.filename}` : '',
      addedBy: req.admin._id
    });
    await teacher.save();

    // Send welcome email (non-blocking)
    sendEmail(teacherWelcomeEmail(teacher, rawPassword)).then(sent => {
      if (!sent) console.log('⚠️ Welcome email failed for', teacher.email);
    });

    await ActivityLog.create({
      action: 'Teacher Added', performedBy: req.admin.name, performedByRole: 'admin',
      performedById: req.admin._id, target: teacher.name,
      details: `Added teacher ${teacher.name} (${teacher.employeeId}) — Email: ${teacher.email}`
    });

    res.redirect('/admin/teachers?success=Teacher added successfully! Login credentials emailed.');
  } catch (err) {
    console.error('Add teacher error:', err);
    res.render('admin/teacher-form', {
      title: 'Add Teacher', admin: req.admin, teacher: null,
      error: err.code === 11000 ? 'Email already registered' : err.message
    });
  }
});

// ─── EDIT TEACHER FORM ──────────────────────────────────────────
router.get('/teachers/edit/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.redirect('/admin/teachers?error=Teacher not found');
    res.render('admin/teacher-form', { title: 'Edit Teacher', admin: req.admin, teacher, error: null });
  } catch (err) {
    res.redirect('/admin/teachers?error=' + err.message);
  }
});

// ─── EDIT TEACHER POST ──────────────────────────────────────────
router.post('/teachers/edit/:id', (req, res, next) => {
  uploadPhoto.single('profilePhoto')(req, res, (err) => {
    if (err) {
      return res.redirect(`/admin/teachers/edit/${req.params.id}?error=Photo upload error: ${err.message}`);
    }
    next();
  });
}, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.redirect('/admin/teachers?error=Teacher not found');

    const { name, email, phone, qualification, subject, classAssigned, section, address, gender, dateOfBirth, joiningDate, isActive } = req.body;

    // Track changes for email
    const changes = [];
    if (teacher.name !== name) changes.push(`Name: "${teacher.name}" → "${name}"`);
    if (teacher.classAssigned !== classAssigned) changes.push(`Class: "${teacher.classAssigned || 'None'}" → "${classAssigned || 'None'}"`);
    if (teacher.subject !== subject) changes.push(`Subject: "${teacher.subject || '—'}" → "${subject || '—'}"`);
    if (teacher.isActive !== (isActive === 'true')) changes.push(`Status: ${teacher.isActive ? 'Active' : 'Inactive'} → ${isActive === 'true' ? 'Active' : 'Inactive'}`);

    teacher.name = name?.trim() || teacher.name;
    teacher.email = email?.toLowerCase().trim() || teacher.email;
    teacher.phone = phone;
    teacher.qualification = qualification;
    teacher.subject = subject;
    teacher.classAssigned = classAssigned;
    teacher.section = section;
    teacher.address = address;
    teacher.gender = gender;
    if (dateOfBirth) teacher.dateOfBirth = dateOfBirth;
    if (joiningDate) teacher.joiningDate = joiningDate;
    teacher.isActive = isActive === 'true';
    if (req.file) teacher.profilePhoto = `/uploads/photos/${req.file.filename}`;

    await teacher.save({ validateBeforeSave: false });

    if (changes.length > 0) {
      sendEmail(teacherUpdateEmail(teacher, changes.join(' | '))).then(sent => {
        if (!sent) console.log('⚠️ Update email failed for', teacher.email);
      });
      await ActivityLog.create({
        action: 'Teacher Updated', performedBy: req.admin.name, performedByRole: 'admin',
        performedById: req.admin._id, target: teacher.name, details: changes.join(' | ')
      });
    }

    res.redirect('/admin/teachers?success=Teacher updated successfully!');
  } catch (err) {
    console.error('Edit teacher error:', err);
    res.redirect(`/admin/teachers/edit/${req.params.id}?error=${encodeURIComponent(err.message)}`);
  }
});

// ─── RESET TEACHER PASSWORD ─────────────────────────────────────
router.post('/teachers/reset-password/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.json({ success: false, message: 'Teacher not found' });

    const newPassword = `Teacher@${Math.floor(1000 + Math.random() * 9000)}`;
    teacher.password = newPassword;
    await teacher.save();

    const sent = await sendEmail(teacherPasswordResetEmail(teacher, newPassword));
    await ActivityLog.create({
      action: 'Password Reset', performedBy: req.admin.name, performedByRole: 'admin',
      performedById: req.admin._id, target: teacher.name,
      details: `Password reset — Email ${sent ? 'sent' : 'failed'} to ${teacher.email}`
    });

    res.json({
      success: true,
      message: sent ? `Password reset! New password emailed to ${teacher.email}` : 'Password reset but email delivery failed. Check console.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.json({ success: false, message: err.message });
  }
});

// ─── DELETE TEACHER ─────────────────────────────────────────────
router.post('/teachers/delete/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (teacher) {
      await ActivityLog.create({
        action: 'Teacher Deleted', performedBy: req.admin.name, performedByRole: 'admin',
        performedById: req.admin._id, target: teacher.name, details: teacher.email
      });
    }
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── STUDENTS ───────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const { classFilter, search } = req.query;
    let query = {};
    if (classFilter) query.currentClass = classFilter;
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { enrollmentId: new RegExp(search, 'i') },
      { rollNo: new RegExp(search, 'i') }
    ];
    const [students, classes] = await Promise.all([
      Student.find(query).populate('addedBy', 'name').sort({ currentClass: 1, rollNo: 1 }),
      Student.distinct('currentClass')
    ]);
    res.render('admin/students', {
      title: 'All Students', admin: req.admin, students, classes,
      classFilter: classFilter || '', search: search || ''
    });
  } catch (err) {
    res.render('admin/students', { title: 'All Students', admin: req.admin, students: [], classes: [], classFilter: '', search: '', error: err.message });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('addedBy', 'name').populate('lastUpdatedBy', 'name');
    if (!student) return res.redirect('/admin/students?error=Student not found');
    res.render('admin/student-detail', { title: student.name, admin: req.admin, student });
  } catch (err) {
    res.redirect('/admin/students?error=' + err.message);
  }
});

// ─── ACTIVITY LOG ────────────────────────────────────────────────
router.get('/activities', async (req, res) => {
  try {
    const activities = await ActivityLog.find().sort({ createdAt: -1 }).limit(200);
    res.render('admin/activities', { title: 'Activity Log', admin: req.admin, activities });
  } catch (err) {
    res.render('admin/activities', { title: 'Activity Log', admin: req.admin, activities: [] });
  }
});

// ─── PROFILE ────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select('-password');
  res.render('admin/profile', { title: 'My Profile', admin, error: null, success: null });
});

router.post('/profile', (req, res, next) => {
  uploadPhoto.single('profilePhoto')(req, res, (err) => {
    if (err) {
      return res.render('admin/profile', {
        title: 'My Profile', admin: req.admin,
        error: 'Photo upload error: ' + err.message, success: null
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const admin = await Admin.findById(req.admin._id);

    admin.name = name?.trim() || admin.name;
    admin.email = email?.toLowerCase().trim() || admin.email;
    admin.phone = phone;
    if (req.file) admin.profilePhoto = `/uploads/photos/${req.file.filename}`;

    await admin.save({ validateBeforeSave: false });

    const updatedAdmin = await Admin.findById(req.admin._id).select('-password');
    res.render('admin/profile', { title: 'My Profile', admin: updatedAdmin, error: null, success: 'Profile updated successfully!' });
  } catch (err) {
    console.error('Profile update error:', err);
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.render('admin/profile', { title: 'My Profile', admin, error: 'Update failed: ' + err.message, success: null });
  }
});

// ─── CHANGE PASSWORD ────────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'New passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return res.json({ success: false, message: 'Current password is incorrect' });

    admin.password = newPassword;
    await admin.save();
    res.json({ success: true, message: '✅ Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
