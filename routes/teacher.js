const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const ActivityLog = require('../models/ActivityLog');
const { protectTeacher } = require('../middleware/auth');
const { uploadPhoto, uploadExcel } = require('../middleware/upload');
const { generateBonafideDocx, generateUtaraDocx } = require('../utils/docGenerator');
const { generateBulkPDF } = require('../utils/pdfGenerator');
const { parseExcelToStudents } = require('../utils/excelParser');

router.use(protectTeacher);

// ─── DASHBOARD ──────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const teacher = req.teacher;
    // Build query for "my class" — match class AND section if both set
    const myClassQuery = {};
    if (teacher.classAssigned) {
      myClassQuery.currentClass = String(teacher.classAssigned).trim();
    }
    if (teacher.section) {
      myClassQuery.currentSection = String(teacher.section).trim();
    }

    const [totalStudents, bonafideCount, utaraCount, recentStudents] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ bonafideGenerated: true }),
      Student.countDocuments({ utaraGenerated: true }),
      Student.find().sort({ createdAt: -1 }).limit(6)
    ]);
    const classStudents = teacher.classAssigned
      ? await Student.countDocuments(myClassQuery) : 0;

    res.render('teacher/dashboard', {
      title: 'शिक्षक डॅशबोर्ड', teacher,
      stats: { totalStudents, classStudents, bonafideCount, utaraCount },
      myClassQuery: { class: teacher.classAssigned || '', section: teacher.section || '' },
      recentStudents
    });
  } catch (err) {
    console.error(err);
    res.render('teacher/dashboard', {
      title: 'डॅशबोर्ड', teacher: req.teacher,
      stats: { totalStudents: 0, classStudents: 0, bonafideCount: 0, utaraCount: 0 },
      myClassQuery: { class: '', section: '' },
      recentStudents: []
    });
  }
});

// ─── STUDENTS LIST ──────────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const { search, classFilter, sectionFilter } = req.query;
    let query = {};
    if (classFilter) query.currentClass = classFilter;
    if (sectionFilter) query.currentSection = sectionFilter;
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { enrollmentId: new RegExp(search, 'i') },
      { rollNo: new RegExp(search, 'i') },
      { fatherName: new RegExp(search, 'i') }
    ];
    const [students, classes] = await Promise.all([
      Student.find(query).sort({ currentClass: 1, rollNo: 1 }),
      Student.distinct('currentClass')
    ]);
    res.render('teacher/students', {
      title: 'विद्यार्थी यादी', teacher: req.teacher,
      students, classes,
      classFilter: classFilter || '',
      sectionFilter: sectionFilter || '',
      search: search || '',
      success: req.query.success || null
    });
  } catch (err) {
    res.render('teacher/students', {
      title: 'विद्यार्थी', teacher: req.teacher, students: [], classes: [],
      classFilter: '', sectionFilter: '', search: '', success: null
    });
  }
});

// ─── ADD STUDENT FORM ───────────────────────────────────────────
router.get('/students/add', (req, res) => {
  res.render('teacher/student-form', { title: 'नवीन विद्यार्थी', teacher: req.teacher, student: null, error: null });
});

// ─── ADD STUDENT POST ───────────────────────────────────────────
router.post('/students/add', (req, res, next) => {
  uploadPhoto.single('photo')(req, res, (err) => {
    if (err) return res.render('teacher/student-form', { title: 'नवीन विद्यार्थी', teacher: req.teacher, student: null, error: 'फोटो त्रुटी: ' + err.message });
    next();
  });
}, async (req, res) => {
  try {
    const d = req.body;
    if (!d.name || !d.currentClass) {
      return res.render('teacher/student-form', { title: 'नवीन विद्यार्थी', teacher: req.teacher, student: null, error: 'विद्यार्थ्याचे नाव आणि वर्ग आवश्यक आहे' });
    }
    const student = new Student({
      ...d,
      name: d.name.trim(),
      photo: req.file ? `/uploads/photos/${req.file.filename}` : '',
      addedBy: req.teacher._id,
      lastUpdatedBy: req.teacher._id
    });
    await student.save();
    await ActivityLog.create({
      action: 'Student Added', performedBy: req.teacher.name, performedByRole: 'teacher',
      performedById: req.teacher._id, target: student.name,
      details: `वर्ग ${student.currentClass} | ID: ${student.enrollmentId}`
    });
    res.redirect('/teacher/students?success=विद्यार्थी यशस्वीरित्या जोडला!');
  } catch (err) {
    console.error(err);
    res.render('teacher/student-form', { title: 'नवीन विद्यार्थी', teacher: req.teacher, student: null, error: err.message });
  }
});

// ─── STUDENT DETAIL ─────────────────────────────────────────────
router.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.redirect('/teacher/students');
    res.render('teacher/student-detail', { title: student.name, teacher: req.teacher, student, success: req.query.success || null });
  } catch (err) {
    res.redirect('/teacher/students');
  }
});

// ─── EDIT STUDENT ───────────────────────────────────────────────
router.get('/students/:id/edit', async (req, res) => {
  const student = await Student.findById(req.params.id).catch(() => null);
  if (!student) return res.redirect('/teacher/students');
  res.render('teacher/student-form', { title: 'विद्यार्थी संपादन', teacher: req.teacher, student, error: null });
});

router.post('/students/:id/edit', (req, res, next) => {
  uploadPhoto.single('photo')(req, res, (err) => {
    if (err) return res.redirect(`/teacher/students/${req.params.id}/edit?error=${err.message}`);
    next();
  });
}, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.redirect('/teacher/students');
    const d = req.body;
    // Sanitize: if any field came in as array (duplicate form fields), take the last value
    const sanitized = {};
    for (const key of Object.keys(d)) {
      sanitized[key] = Array.isArray(d[key]) ? d[key][d[key].length - 1] : d[key];
    }
    Object.assign(student, { ...sanitized, name: sanitized.name?.trim() || student.name, lastUpdatedBy: req.teacher._id });
    if (req.file) student.photo = `/uploads/photos/${req.file.filename}`;
    await student.save();
    await ActivityLog.create({
      action: 'Student Updated', performedBy: req.teacher.name, performedByRole: 'teacher',
      performedById: req.teacher._id, target: student.name
    });
    res.redirect(`/teacher/students/${student._id}?success=विद्यार्थी माहिती अपडेट झाली!`);
  } catch (err) {
    const student = await Student.findById(req.params.id).catch(() => null);
    res.render('teacher/student-form', { title: 'संपादन', teacher: req.teacher, student, error: err.message });
  }
});

// ─── DELETE STUDENT ─────────────────────────────────────────────
router.post('/students/:id/delete', async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (student) await ActivityLog.create({ action: 'Student Deleted', performedBy: req.teacher.name, performedByRole: 'teacher', performedById: req.teacher._id, target: student.name });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── BONAFIDE PREVIEW ───────────────────────────────────────────
router.get('/students/:id/bonafide', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.redirect('/teacher/students');
    res.render('teacher/bonafide-preview', { title: 'बोनाफाईड — ' + student.name, teacher: req.teacher, student });
  } catch (err) {
    res.redirect('/teacher/students');
  }
});

// ─── BONAFIDE DOWNLOAD (DOCX) ───────────────────────────────────
router.get('/students/:id/bonafide/download', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).send('Student not found');
    const buffer = await generateBonafideDocx(student);
    
    // Mark as generated
    await Student.findByIdAndUpdate(req.params.id, { bonafideGenerated: true, bonafideGeneratedAt: new Date() });
    await ActivityLog.create({
      action: 'Bonafide Generated', performedBy: req.teacher.name, performedByRole: 'teacher',
      performedById: req.teacher._id, target: student.name, details: 'बोनाफाईड प्रमाणपत्र डाउनलोड केले'
    });

    const safeFilename = `Bonafide_${(student.enrollmentId||'student').replace(/[^\x20-\x7E]/g,'_')}.docx`;
    const utf8Filename = encodeURIComponent(`Bonafide_${student.name}_${student.enrollmentId}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Filename}`);
    res.send(buffer);
  } catch (err) {
    console.error('Bonafide download error:', err);
    res.status(500).send('Download failed: ' + err.message);
  }
});

// ─── UTARA PREVIEW ──────────────────────────────────────────────
router.get('/students/:id/utara', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.redirect('/teacher/students');
    res.render('teacher/utara-preview', { title: 'प्रवेश निर्गम उतारा — ' + student.name, teacher: req.teacher, student });
  } catch (err) {
    res.redirect('/teacher/students');
  }
});

// ─── UTARA DOWNLOAD (DOCX) ──────────────────────────────────────
router.get('/students/:id/utara/download', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).send('Student not found');
    const buffer = await generateUtaraDocx(student);

    await Student.findByIdAndUpdate(req.params.id, { utaraGenerated: true, utaraGeneratedAt: new Date() });
    await ActivityLog.create({
      action: 'Utara Generated', performedBy: req.teacher.name, performedByRole: 'teacher',
      performedById: req.teacher._id, target: student.name, details: 'प्रवेश निर्गम उतारा डाउनलोड केले'
    });

    const safeFilename = `Utara_${(student.enrollmentId||'student').replace(/[^\x20-\x7E]/g,'_')}.docx`;
    const utf8Filename = encodeURIComponent(`Utara_${student.name}_${student.enrollmentId}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Filename}`);
    res.send(buffer);
  } catch (err) {
    console.error('Utara download error:', err);
    res.status(500).send('Download failed: ' + err.message);
  }
});

// ─── EXCEL TEMPLATE DOWNLOAD ────────────────────────────────────
// ─── NAMOONA EXCEL TEMPLATE DOWNLOAD ───────────────────────────
router.get('/excel-template', (req, res) => {
  const templatePath = path.join(__dirname, '../public/namoona_template.xlsx');
  if (!fs.existsSync(templatePath)) {
    return res.status(404).send('नमुना फाइल सापडली नाही.');
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="vidyarthi_namoona.xlsx"');
  res.sendFile(templatePath);
});

// ─── EXPORT STUDENTS TO EXCEL ───────────────────────────────────
router.get('/export-students', async (req, res) => {
  try {
    const filter = {};
    if (req.query.class) filter.currentClass = req.query.class;
    if (req.query.section) filter.currentSection = req.query.section;

    const students = await Student.find(filter).sort({ currentClass: 1, rollNo: 1 });

    const data = students.map((s, i) => ({
      'अनु. क्र.': i + 1,
      'Enrollment ID (प्रवेश क्रमांक)': s.enrollmentId || '',
      'Roll No': s.rollNo || '',
      'Saral ID (सरल आय. डि. नं)': s.saralId || '',
      'UDISE No (युडायस नंबर)': s.udiseNo || '',
      'Aadhar No (आधार नं.)': s.aadharNo || '',
      'Name (विद्यार्थ्याचे नाव)': s.name || '',
      'Father Name (वडिलांचे नाव)': s.fatherName || '',
      'Mother Name (आईचे नाव)': s.motherName || '',
      'Gender (लिंग)': s.gender || '',
      'Date Of Birth / जन्म दिनांक': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-IN') : '',
      'Date Of Birth In Words (अक्षरी)': s.dateOfBirthInWords || '',
      'Birth Place (जन्मस्थळ)': s.birthPlace || '',
      'Nationality (राष्ट्रीयत्व)': s.nationality || '',
      'Religion (धर्म)': s.religion || '',
      'Caste (जात)': s.caste || '',
      'Category (प्रवर्ग)': s.category || '',
      'Mother Tongue (मातृभाषा)': s.motherTongue || '',
      'Current Class (वर्तमान वर्ग)': s.currentClass || '',
      'Section (तुकडी)': s.currentSection || '',
      'Academic Year (शैक्षणिक वर्ष)': s.academicYear || '',
      'Admission Date (प्रवेश दिनांक)': s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-IN') : '',
      'Admission Class (प्रवेशाच्या वेळेस वर्ग)': s.admissionClass || '',
      'Previous School (पूर्वीची शाळा)': s.previousSchool || '',
      'Leaving Class (शाळा सोडताना वर्ग)': s.leavingClass || '',
      'Leaving Date (शाळा सोडताना दिनांक)': s.leavingDate ? new Date(s.leavingDate).toLocaleDateString('en-IN') : '',
      'Reason For Leaving (शाळा सोडण्याचे कारण)': s.reasonForLeaving || '',
      'Remarks (शेरा)': s.remarks || '',
      'Parent Contact (पालकाचा संपर्क)': s.parentContact || '',
      'Parent Email': s.parentEmail || '',
      'Address (पत्ता)': s.address || '',
      'General Conduct (सर्वसाधारण वर्तणूक)': s.generalConduct || '',
      'Bonafide Generated': s.bonafideGenerated ? 'हो' : 'नाही',
      'Utara Generated': s.utaraGenerated ? 'हो' : 'नाही',
    }));

    const XLSX = require('xlsx');
    const ws = xlsx.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
    ws['!cols'] = colWidths;
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `विद्यार्थी_यादी_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Export failed: ' + err.message);
  }
});

// ─── EXCEL UPLOAD ───────────────────────────────────────────────
router.get('/upload-excel', (req, res) => {
  res.render('teacher/upload-excel', {
    title: 'Excel आयात', teacher: req.teacher,
    error: null, success: null, imported: 0, errors: [], warnings: []
  });
});

router.post('/upload-excel', (req, res, next) => {
  uploadExcel.single('excelFile')(req, res, (err) => {
    if (err) return res.render('teacher/upload-excel', {
      title: 'Excel आयात', teacher: req.teacher,
      error: 'फाइल अपलोड त्रुटी: ' + err.message,
      success: null, imported: 0, errors: [], warnings: []
    });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.render('teacher/upload-excel', {
    title: 'Excel आयात', teacher: req.teacher,
    error: 'कृपया Excel किंवा CSV फाइल निवडा',
    success: null, imported: 0, errors: [], warnings: []
  });

  const renderErr = (msg) => res.render('teacher/upload-excel', {
    title: 'Excel आयात', teacher: req.teacher,
    error: msg, success: null, imported: 0, errors: [], warnings: []
  });

  try {
    // Parse using the bulletproof parser (same column map as Namoona template)
    const parsed = parseExcelToStudents(req.file.path);
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    if (!parsed.success) return renderErr(parsed.error);
    if (!parsed.students.length) return renderErr('Excel मध्ये कोणताही वैध विद्यार्थी सापडला नाही. नमुना डाउनलोड करून तोच वापरा.');

    let imported = 0;
    const rowErrors  = [...(parsed.rowErrors || [])];
    const warnings   = [];

    // Auto-generate enrollment IDs if missing
    const year = new Date().getFullYear().toString().slice(2);
    let   seq  = await Student.countDocuments();

    for (const s of parsed.students) {
      // Auto-assign enrollment ID if blank
      if (!s.enrollmentId) {
        seq++;
        s.enrollmentId = `TVV${year}${String(seq).padStart(3, '0')}`;
      }
      // Defaults
      if (!s.nationality)  s.nationality  = 'भारतीय';
      if (!s.motherTongue) s.motherTongue = 'मराठी';
      if (!s.generalConduct) s.generalConduct = 'चांगले';

      // Warn about missing Bonafide/Utara fields (but still import)
      const missing = [];
      if (!s.dateOfBirthInWords) missing.push('जन्म दिनांक अक्षरी (Bonafide)');
      if (!s.academicYear)       missing.push('शैक्षणिक वर्ष (Bonafide)');
      if (!s.caste)              missing.push('जात (Bonafide)');
      if (!s.motherName)         missing.push('आईचे नाव (Utara)');
      if (missing.length) warnings.push(`"${s.name}": ${missing.join(', ')}`);

      try {
        const doc = new Student({
          enrollmentId:       s.enrollmentId,
          saralId:            s.saralId || '',
          udiseNo:            s.udiseNo || '',
          rollNo:             s.rollNo || '',
          name:               s.name,
          aadharNo:           s.aadharNo || '',
          dateOfBirth:        s.dateOfBirth,
          dateOfBirthInWords: s.dateOfBirthInWords || '',
          gender:             s.gender || '',
          nationality:        s.nationality,
          religion:           s.religion || '',
          caste:              s.caste || '',
          category:           s.category || '',
          motherTongue:       s.motherTongue,
          birthPlace:         s.birthPlace || '',
          fatherName:         s.fatherName || '',
          motherName:         s.motherName || '',
          guardianName:       s.guardianName || '',
          parentContact:      s.parentContact || '',
          parentEmail:        s.parentEmail || '',
          address:            s.address || '',
          currentClass:       s.currentClass,
          currentSection:     s.currentSection || '',
          academicYear:       s.academicYear || '',
          admissionDate:      s.admissionDate,
          admissionClass:     s.admissionClass || '',
          previousSchool:     s.previousSchool || '',
          leavingClass:       s.leavingClass || '',
          leavingDate:        s.leavingDate,
          reasonForLeaving:   s.reasonForLeaving || '',
          remarks:            s.remarks || '',
          generalConduct:     s.generalConduct,
          addedBy:            req.teacher._id,
          lastUpdatedBy:      req.teacher._id,
        });
        await doc.save();
        imported++;
      } catch (e) {
        if (e.code === 11000) {
          rowErrors.push(`"${s.name}": आधीच नोंदवलेले — वगळले (Enrollment ID: ${s.enrollmentId})`);
        } else {
          rowErrors.push(`"${s.name}": ${e.message}`);
        }
      }
    }

    await ActivityLog.create({
      action: 'Excel Import', performedBy: req.teacher.name,
      performedByRole: 'teacher', performedById: req.teacher._id,
      details: `${imported} विद्यार्थी आयात केले. ${rowErrors.length} त्रुटी. ${warnings.length} सूचना.`
    });

    res.render('teacher/upload-excel', {
      title: 'Excel आयात', teacher: req.teacher, error: null,
      success: `✅ ${imported} विद्यार्थी यशस्वीरित्या आयात झाले!`,
      imported, errors: rowErrors, warnings
    });

  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.render('teacher/upload-excel', {
      title: 'Excel आयात', teacher: req.teacher,
      error: 'फाइल प्रक्रिया त्रुटी: ' + err.message,
      success: null, imported: 0, errors: [], warnings: []
    });
  }
});

// ─── BULK DOCX EXPORT (renamed from bulk-pdf) ───────────────────
// GET /teacher/bulk-pdf?type=bonafide&classFilter=8&section=A
// Returns a DOCX file with one page per student (uses docx lib, zero extra installs)
router.get('/bulk-pdf', async (req, res) => {
  const { type, classFilter, section } = req.query;
  if (!type || !['bonafide','utara'].includes(type)) {
    return res.status(400).send('type parameter must be bonafide or utara');
  }
  try {
    const query = {};
    if (classFilter) query.currentClass = classFilter;
    if (section)     query.currentSection = section;

    const students = await Student.find(query).sort({ rollNo: 1, name: 1 });
    if (!students.length) {
      return res.status(404).send('या वर्गात कोणताही विद्यार्थी नाही');
    }

    const docxBuf = await generateBulkPDF(students, type);  // returns DOCX buffer
    const cls     = classFilter || 'all';
    const sec     = section ? `-${section}` : '';
    const label   = type === 'bonafide' ? 'Bonafide' : 'Utara';
    // Use only ASCII-safe characters in the header filename
    const safeClass = cls.replace(/[^\x20-\x7E]/g, '_');
    const safeSec   = sec.replace(/[^\x20-\x7E]/g, '_');
    const filename  = `${label}_Class${safeClass}${safeSec}.docx`;

    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':       docxBuf.length,
    });
    res.send(docxBuf);
  } catch (err) {
    console.error('Bulk DOCX error:', err);
    res.status(500).send('DOCX तयार करताना त्रुटी: ' + err.message);
  }
});

// ─── BULK HTML PRINT PAGE ────────────────────────────────────────
// GET /teacher/bulk-html?type=bonafide&classFilter=8&section=A
// Returns a print-ready HTML page → browser can Print → Save as PDF
router.get('/bulk-html', async (req, res) => {
  const { type, classFilter, section } = req.query;
  if (!type || !['bonafide','utara'].includes(type)) {
    return res.status(400).send('type parameter must be bonafide or utara');
  }
  try {
    const query = {};
    if (classFilter) query.currentClass = classFilter;
    if (section)     query.currentSection = section;

    const students = await Student.find(query).sort({ rollNo: 1, name: 1 });
    if (!students.length) {
      return res.status(404).send('या वर्गात कोणताही विद्यार्थी नाही');
    }

    const { generateBulkHTML } = require('../utils/pdfGenerator');
    const html = generateBulkHTML(students, type, req);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Bulk HTML error:', err);
    res.status(500).send('HTML तयार करताना त्रुटी: ' + err.message);
  }
});

// ─── PROFILE ────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const teacher = await Teacher.findById(req.teacher._id).select('-password');
  res.render('teacher/profile', { title: 'माझी प्रोफाइल', teacher, error: null, success: null });
});

router.post('/profile', (req, res, next) => {
  uploadPhoto.single('profilePhoto')(req, res, (err) => {
    if (err) return res.render('teacher/profile', { title: 'माझी प्रोफाइल', teacher: req.teacher, error: 'फोटो त्रुटी: ' + err.message, success: null });
    next();
  });
}, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.teacher._id);
    const { name, phone, address } = req.body;
    teacher.name = name?.trim() || teacher.name;
    teacher.phone = phone;
    teacher.address = address;
    if (req.file) teacher.profilePhoto = `/uploads/photos/${req.file.filename}`;
    await teacher.save({ validateBeforeSave: false });
    const updated = await Teacher.findById(req.teacher._id).select('-password');
    res.render('teacher/profile', { title: 'माझी प्रोफाइल', teacher: updated, error: null, success: '✅ प्रोफाइल अपडेट झाली!' });
  } catch (err) {
    const teacher = await Teacher.findById(req.teacher._id).select('-password').catch(() => req.teacher);
    res.render('teacher/profile', { title: 'माझी प्रोफाइल', teacher, error: 'अपडेट अयशस्वी: ' + err.message, success: null });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) return res.json({ success: false, message: 'नवीन पासवर्ड जुळत नाही' });
    if (newPassword.length < 6) return res.json({ success: false, message: 'पासवर्ड किमान 6 अक्षरे असावा' });
    const teacher = await Teacher.findById(req.teacher._id);
    const isMatch = await teacher.comparePassword(currentPassword);
    if (!isMatch) return res.json({ success: false, message: 'सध्याचा पासवर्ड चुकीचा आहे' });
    teacher.password = newPassword;
    await teacher.save();
    res.json({ success: true, message: '✅ पासवर्ड बदलला!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
