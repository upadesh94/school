/**
 * pdfGenerator.js — Bulk PDF/DOCX generator (ZERO new dependencies).
 *
 * APPROACH: Uses the 'docx' library (already in package.json) to generate
 * a single multi-section DOCX file with one page per student.
 * Users can open it in Word and print/save as PDF, OR we serve it directly.
 *
 * We also expose generateBulkHTML() which returns a printable HTML page
 * the browser can print as PDF — served at /teacher/bulk-html endpoint.
 *
 * The /teacher/bulk-pdf route now serves the DOCX as a .docx download
 * (renamed approach since true server-side PDF needs Chromium/wkhtmltopdf).
 * The /teacher/bulk-html route serves a print-ready HTML page.
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, UnderlineType, ImageRun,
  PageBreak
} = require('docx');
const fs   = require('fs');
const path = require('path');

const SCHOOL   = 'तुलजाभवानी माध्यमिक विद्यालय';
const ADDRESS  = 'वासुसायगाव, ता. गंगापूर';
const TODAY    = () => new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
const fmt      = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

const NB   = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NBS  = { top: NB, bottom: NB, left: NB, right: NB };
const BBOT = { top: NB, left: NB, right: NB, bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } };
const BTOP = { top: { style: BorderStyle.SINGLE, size: 6, color: '000000' }, bottom: NB, left: NB, right: NB };
const BOX  = { style: BorderStyle.SINGLE, size: 6, color: '000000' };

const mr = (text, o = {}) => new TextRun({
  text: text || '',
  font: 'Noto Sans Devanagari',
  size: o.size || 22,
  bold: o.bold || false,
  underline: o.underline,
});

const getStamp = () => {
  const p = path.join(__dirname, '../public/images/stamp.png');
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
};

const stampPara = (align = AlignmentType.RIGHT, w = 170, h = 100) => {
  const buf = getStamp();
  if (!buf) return new Paragraph({ children: [] });
  return new Paragraph({
    alignment: align,
    children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' })],
  });
};

const lbl = (text, w) => new TableCell({
  width: { size: w, type: WidthType.DXA }, borders: NBS,
  margins: { top: 60, bottom: 60, left: 0, right: 60 },
  children: [new Paragraph({ children: [mr(text, { bold: true })] })],
});
const colon = () => new TableCell({
  width: { size: 200, type: WidthType.DXA }, borders: NBS,
  margins: { top: 60, bottom: 60, left: 0, right: 0 },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [mr(':', { bold: true })] })],
});
const val = (text, w) => new TableCell({
  width: { size: w, type: WidthType.DXA }, borders: NBS,
  margins: { top: 60, bottom: 60, left: 80, right: 0 },
  children: [new Paragraph({ border: BBOT, children: [mr(text || '')] })],
});
const fRow = (label, value, lw, vw) => new TableRow({
  height: { value: 440, rule: 'atLeast' },
  children: [lbl(label, lw), colon(), val(value, vw)],
});

// ── Build BONAFIDE section for one student ─────────────────────
const bonafideSection = (student, addPageBreak) => {
  const classStr = (student.currentClass || '') + (student.currentSection ? ' ' + student.currentSection : '');
  const stampBuf = getStamp();

  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [mr(SCHOOL, { bold: true, size: 36 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [mr(ADDRESS, { bold: true, size: 26 })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.DOUBLE, size: 8, color: '000000', space: 1 } }, spacing: { after: 280 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 320 },
      children: [mr('बोनाफाईड  सर्टिफिकेट', { bold: true, size: 40, underline: { type: UnderlineType.SINGLE } })],
    }),
    new Table({
      width: { size: 9026, type: WidthType.DXA }, columnWidths: [1600, 200, 7226],
      borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB },
      rows: [fRow('आधार नं.', student.aadharNo || '', 1600, 7226)],
    }),
    new Paragraph({ spacing: { before: 120, after: 0, line: 480 }, children: [mr('देण्यात   येते   की,   ', { bold: true, size: 24 }), mr(student.name || '', { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })] }),
    new Paragraph({ spacing: { after: 0, line: 480 }, children: [mr('हा  /  ही   या   शाळेचा   विद्यार्थी   /   विद्यार्थिनी   असून   शैक्षणिक   वर्ष   (   ', { bold: true, size: 24 }), mr(student.academicYear || '', { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } }), mr('   )   मध्ये       ', { bold: true, size: 24 })] }),
    new Paragraph({ spacing: { after: 0, line: 480 }, children: [mr(classStr, { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } }), mr('   वर्गात    शिक्षण   घेत   आहे.   /   होता.   शाळेच्या    जनरल    रजिस्टर    नुसार   त्याची    ', { bold: true, size: 24 })] }),
    new Paragraph({ spacing: { after: 0, line: 480 }, children: [mr('जन्म   तारीख    (अंकी)   ', { bold: true, size: 24 }), mr(fmt(student.dateOfBirth), { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } }), mr('    (अक्षरी)   ', { bold: true, size: 24 }), mr(student.dateOfBirthInWords || '', { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })] }),
    new Paragraph({ spacing: { after: 0, line: 480 }, children: [mr('_________________________________________________________________________  ही असू', { bold: true, size: 24 })] }),
    new Paragraph({ spacing: { after: 0, line: 480 }, children: [mr('जात  ', { bold: true, size: 24 }), mr(student.caste || '', { bold: true, size: 24, underline: { type: UnderlineType.SINGLE } }), mr('  ही   आहे.   तसेच   सदर  विद्यार्थ्यांची  वर्तणूक  चांगली  आहे.', { bold: true, size: 24 })] }),
    new Table({
      width: { size: 9026, type: WidthType.DXA }, columnWidths: [1400, 200, 7426],
      borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB },
      rows: [fRow('दिनांक', TODAY(), 1400, 7426)],
    }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Table({
      width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513],
      borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: NBS, children: [new Paragraph({ children: [] }), new Paragraph({ children: [] }), new Paragraph({ border: BTOP, children: [mr('लिपिक', { bold: true })] })] }),
        new TableCell({ width: { size: 4513, type: WidthType.DXA }, borders: NBS, children: [new Paragraph({ children: [] }), stampPara(AlignmentType.RIGHT, 170, 100), new Paragraph({ border: BTOP, alignment: AlignmentType.RIGHT, children: [mr('मुख्याध्यापक / प्राचार्य', { bold: true })] })] }),
      ] })],
    }),
  ];

  if (addPageBreak) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return children;
};

// ── Build UTARA section for one student ───────────────────────
const utaraSection = (student, addPageBreak) => {
  const aadharStr = (student.aadharNo || '').replace(/\s/g, '');
  const saralStr  = student.saralId || '';
  const makeBoxRow = (str, count) => {
    const arr = (str + ' '.repeat(count)).slice(0, count).split('');
    return new TableRow({
      children: arr.map(ch => new TableCell({
        width: { size: 300, type: WidthType.DXA },
        borders: { top: BOX, bottom: BOX, left: BOX, right: BOX },
        margins: { top: 20, bottom: 20, left: 10, right: 10 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [mr(ch.trim(), { size: 18 })] })],
      })),
    });
  };

  const saralBoxTable = new Table({ width: { size: 5700, type: WidthType.DXA }, columnWidths: Array(19).fill(300), borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [makeBoxRow(saralStr, 19)] });
  const aadharBoxTable = new Table({ width: { size: 3600, type: WidthType.DXA }, columnWidths: Array(12).fill(300), borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [makeBoxRow(aadharStr, 12)] });

  const stampBuf = getStamp();
  const field17Val = new TableCell({
    width: { size: 7346, type: WidthType.DXA }, borders: NBS,
    margins: { top: 60, bottom: 60, left: 80, right: 0 },
    children: stampBuf
      ? [new Paragraph({ children: [new ImageRun({ data: stampBuf, transformation: { width: 170, height: 100 }, type: 'png' })] })]
      : [new Paragraph({ border: BBOT, children: [mr('')] })],
  });

  const children = [
    new Paragraph({ spacing: { after: 80 }, children: [mr('शाळेचे नाव : ' + SCHOOL + ', ' + ADDRESS, { bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [mr('प्रवेश  व  निर्गम  रजिस्टर  उतारा', { bold: true, size: 34, underline: { type: UnderlineType.SINGLE } })] }),
    new Table({ width: { size: 10746, type: WidthType.DXA }, columnWidths: [2200, 200, 8346], borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [fRow('युडायस नंबर', student.udiseNo || '', 2200, 8346)] }),
    new Paragraph({ spacing: { after: 60 }, children: [] }),
    new Table({ width: { size: 10746, type: WidthType.DXA }, columnWidths: [5800, 4946], borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [new TableRow({ children: [
      new TableCell({ width: { size: 5800, type: WidthType.DXA }, borders: NBS, margins: { top: 0, bottom: 0, left: 0, right: 40 }, children: [new Paragraph({ children: [mr('सरल आय. डि. नं', { bold: true, size: 20 })] }), saralBoxTable] }),
      new TableCell({ width: { size: 4946, type: WidthType.DXA }, borders: NBS, margins: { top: 0, bottom: 0, left: 40, right: 0 }, children: [new Paragraph({ children: [mr('आधार नं.', { bold: true, size: 20 })] }), aadharBoxTable] }),
    ] })] }),
    new Paragraph({ spacing: { after: 100 }, children: [] }),
    new Table({ width: { size: 10746, type: WidthType.DXA }, columnWidths: [3200, 200, 7346], borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [
      fRow('1) प्रवेश क्रमांक', student.enrollmentId || '', 3200, 7346),
      fRow('2) विद्यार्थ्याचे नाव', student.name || '', 3200, 7346),
      fRow('3) आईचे नाव', student.motherName || '', 3200, 7346),
      fRow('4) धर्म व जात', [student.religion, student.caste].filter(Boolean).join(' / '), 3200, 7346),
      fRow('5) मातृभाषा', student.motherTongue || 'मराठी', 3200, 7346),
      fRow('6) जन्मस्थळ', student.birthPlace || '', 3200, 7346),
      fRow('7) जन्म दिनांक अंकात', fmt(student.dateOfBirth), 3200, 7346),
      fRow('8) जन्म दिनांक अक्षरात', student.dateOfBirthInWords || '', 3200, 7346),
      fRow('9) पूर्वीची शाळा', student.previousSchool || '', 3200, 7346),
      fRow('    शाळेचे नाव', SCHOOL + ', ' + ADDRESS, 3200, 7346),
      fRow('10) वर्ग', (student.currentClass || '') + (student.currentSection ? ' ' + student.currentSection : ''), 3200, 7346),
      fRow('11) प्रवेश दिनांक', fmt(student.admissionDate), 3200, 7346),
      fRow('12) प्रवेशाच्या वेळेस वर्ग', student.admissionClass || '', 3200, 7346),
      fRow('13) शाळा सोडताना वर्ग', student.leavingClass || '', 3200, 7346),
      fRow('14) शाळा सोडताना दिनांक', fmt(student.leavingDate), 3200, 7346),
      fRow('15) शाळा सोडण्याचे कारण', student.reasonForLeaving || '', 3200, 7346),
      fRow('16) शेरा', student.remarks || '', 3200, 7346),
      new TableRow({ height: { value: 1500, rule: 'atLeast' }, children: [lbl('17) मुख्याध्यापकाची स्वाक्षरी', 3200), colon(), field17Val] }),
    ] }),
    new Paragraph({ spacing: { before: 300 }, children: [] }),
    new Table({ width: { size: 10746, type: WidthType.DXA }, columnWidths: [1400, 200, 9146], borders: { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB }, rows: [fRow('दिनांक', TODAY(), 1400, 9146)] }),
  ];

  if (addPageBreak) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return children;
};

/**
 * Generate a single DOCX buffer with one page per student.
 * @param {Array}  students — array of Student mongoose docs or plain objects
 * @param {string} type     — 'bonafide' | 'utara'
 * @returns {Promise<Buffer>}
 */
const generateBulkDOCX = async (students, type) => {
  const allChildren = [];
  students.forEach((s, idx) => {
    const obj        = s && s.toObject ? s.toObject() : (s || {});
    const isLast     = idx === students.length - 1;
    const pageItems  = type === 'bonafide'
      ? bonafideSection(obj, !isLast)
      : utaraSection(obj, !isLast);
    allChildren.push(...pageItems);
  });

  const margin = type === 'bonafide'
    ? { top: 1440, bottom: 1440, left: 1440, right: 1440 }
    : { top: 900,  bottom: 900,  left: 1080, right: 1080 };

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin } },
      children:   allChildren,
    }],
  });

  return Packer.toBuffer(doc);
};

/**
 * Generate print-ready HTML with all students' certificates.
 * Each student gets its own @page section via CSS.
 * The browser can File → Print → Save as PDF.
 */
const generateBulkHTML = (students, type, req) => {
  const baseUrl  = req ? `${req.protocol}://${req.get('host')}` : '';
  const stampUrl = `${baseUrl}/images/stamp.png`;
  const fmtD  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const pages = students.map((s, idx) => {
    const obj    = s && s.toObject ? s.toObject() : (s || {});
    const cls    = (obj.currentClass || '') + (obj.currentSection ? ' ' + obj.currentSection : '');
    const isLast = idx === students.length - 1;

    if (type === 'bonafide') {
      // ── Exact copy of bonafide-preview.ejs certificate HTML ──
      return `<div class="certificate${isLast ? ' last' : ''}">
  <div class="school-name">तुलजाभवानी माध्यमिक विद्यालय</div>
  <div class="school-address">वासुसायगाव, ता. गंगापूर</div>
  <hr class="divider-double">
  <div class="cert-title">बोनाफाईड सर्टिफिकेट</div>
  <div class="field-row">
    <span>आधार नं.</span><span>:</span><span>${obj.aadharNo || ''}</span>
  </div>
  <div class="body-text">
    <p>देण्यात&nbsp;&nbsp;&nbsp;येते&nbsp;&nbsp;&nbsp;की,&nbsp;<span class="uline" style="min-width:220px;">${obj.name || ''}</span></p>
    <p>हा&nbsp;/&nbsp;ही&nbsp;&nbsp;&nbsp;या&nbsp;&nbsp;&nbsp;शाळेचा&nbsp;&nbsp;&nbsp;विद्यार्थी&nbsp;/&nbsp;विद्यार्थिनी&nbsp;&nbsp;&nbsp;असून&nbsp;&nbsp;&nbsp;शैक्षणिक&nbsp;&nbsp;&nbsp;वर्ष&nbsp;&nbsp;(<span class="uline" style="min-width:120px;">&nbsp;${obj.academicYear || ''}&nbsp;</span>)&nbsp;&nbsp;&nbsp;मध्ये&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
    <p><span class="uline" style="min-width:100px;">${cls}</span>&nbsp;&nbsp;&nbsp;वर्गात&nbsp;&nbsp;&nbsp;&nbsp;शिक्षण&nbsp;&nbsp;&nbsp;घेत&nbsp;&nbsp;&nbsp;आहे.&nbsp;/&nbsp;होता.&nbsp;&nbsp;&nbsp;शाळेच्या&nbsp;&nbsp;&nbsp;&nbsp;जनरल&nbsp;&nbsp;&nbsp;&nbsp;रजिस्टर&nbsp;&nbsp;&nbsp;&nbsp;नुसार&nbsp;&nbsp;&nbsp;त्याची&nbsp;&nbsp;&nbsp;&nbsp;</p>
    <p>जन्म&nbsp;&nbsp;&nbsp;तारीख&nbsp;&nbsp;&nbsp;&nbsp;(अंकी)&nbsp;&nbsp;<span class="uline" style="min-width:110px;">${fmtD(obj.dateOfBirth)}</span>&nbsp;&nbsp;&nbsp;(अक्षरी)&nbsp;&nbsp;<span class="uline" style="min-width:200px;">${obj.dateOfBirthInWords || ''}</span></p>
    <p>_________________________________________________________________________&nbsp;&nbsp;ही असू</p>
    <p>जात&nbsp;&nbsp;<span class="uline" style="min-width:140px;">${obj.caste || ''}</span>&nbsp;&nbsp;ही&nbsp;&nbsp;&nbsp;आहे.&nbsp;&nbsp;&nbsp;तसेच&nbsp;&nbsp;&nbsp;सदर&nbsp;&nbsp;विद्यार्थ्यांची&nbsp;&nbsp;वर्तणूक&nbsp;&nbsp;चांगली&nbsp;&nbsp;आहे.</p>
  </div>
  <div class="date-row">
    <span>दिनांक</span><span>:</span><span>${today}</span>
  </div>
  <div class="sig-row">
    <div class="sig-block left">
      <div class="sig-space"></div>
      <div class="sig-line">लिपिक</div>
    </div>
    <div class="sig-block right">
      <div class="sig-space">
        <img src="${stampUrl}" class="stamp-img" alt="मुख्याध्यापक शिक्का" onerror="this.style.display='none'">
      </div>
      <div class="sig-line">मुख्याध्यापक / प्राचार्य</div>
    </div>
  </div>
</div>`;
    } else {
      // ── Utara (matches utara-preview.ejs) ──
      const saralStr  = obj.saralId || '';
      const aadharStr = (obj.aadharNo || '').replace(/\s/g, '');
      const saralArr  = (saralStr  + ' '.repeat(19)).slice(0, 19).split('');
      const aadharArr = (aadharStr + ' '.repeat(12)).slice(0, 12).split('');
      const boxes = arr => arr.map(ch => `<div class="bc">${ch.trim()}</div>`).join('');
      const row   = (n, l, v) => `<tr><td class="ul">${n}) ${l}</td><td class="uc">:</td><td class="uv">${v || ''}</td></tr>`;

      return `<div class="certificate utara-cert${isLast ? ' last' : ''}">
  <div class="school-name" style="text-align:left;font-size:14px;margin-bottom:6px;">${SCHOOL}, ${ADDRESS}</div>
  <div class="cert-title">प्रवेश  व  निर्गम  रजिस्टर  उतारा</div>
  <div class="field-row" style="grid-template-columns:160px 14px 1fr;">
    <span>युडायस नंबर</span><span>:</span><span>${obj.udiseNo || ''}</span>
  </div>
  <div class="boxes-row">
    <div><div class="blbl">सरल आय. डि. नं</div><div class="br">${boxes(saralArr)}</div></div>
    <div><div class="blbl">आधार नं.</div><div class="br">${boxes(aadharArr)}</div></div>
  </div>
  <table class="ut">
    ${row(1,'प्रवेश क्रमांक', obj.enrollmentId)}
    ${row(2,'विद्यार्थ्याचे नाव', `<b>${obj.name || ''}</b>`)}
    ${row(3,'आईचे नाव', obj.motherName)}
    ${row(4,'धर्म व जात', [obj.religion, obj.caste].filter(Boolean).join(' / '))}
    ${row(5,'मातृभाषा', obj.motherTongue || 'मराठी')}
    ${row(6,'जन्मस्थळ', obj.birthPlace)}
    ${row(7,'जन्म दिनांक अंकात', fmtD(obj.dateOfBirth))}
    ${row(8,'जन्म दिनांक अक्षरात', obj.dateOfBirthInWords)}
    ${row(9,'पूर्वीची शाळा', obj.previousSchool || '')}
    <tr><td colspan="3" class="ul sub">&nbsp;&nbsp;&nbsp;शाळेचे नाव : ${SCHOOL}, ${ADDRESS}</td></tr>
    ${row(10,'वर्ग', cls)}
    ${row(11,'प्रवेश दिनांक', fmtD(obj.admissionDate))}
    ${row(12,'प्रवेशाच्या वेळेस वर्ग', obj.admissionClass)}
    ${row(13,'शाळा सोडताना वर्ग', obj.leavingClass)}
    ${row(14,'शाळा सोडताना दिनांक', fmtD(obj.leavingDate))}
    ${row(15,'शाळा सोडण्याचे कारण', obj.reasonForLeaving)}
    ${row(16,'शेरा', obj.remarks)}
    <tr style="height:80px;"><td class="ul">17) मुख्याध्यापकाची स्वाक्षरी</td><td class="uc">:</td>
      <td class="uv"><img src="${stampUrl}" class="stamp-img" style="height:72px;width:auto;" onerror="this.style.display='none'"></td></tr>
  </table>
  <div class="date-row" style="margin-top:10px;grid-template-columns:75px 14px 200px;">
    <span>दिनांक</span><span>:</span><span>${today}</span>
  </div>
</div>`;
    }
  });

  const typeLabel = type === 'bonafide' ? 'बोनाफाईड' : 'उतारा';
  return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<title>${typeLabel} — सर्व विद्यार्थी</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
<style>
/* ── Reset ── */
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans Devanagari',sans-serif; background:#f0f2f5; }

/* ── Toolbar ── */
.toolbar {
  background:#1a237e; padding:14px 28px; display:flex; align-items:center;
  justify-content:space-between; position:sticky; top:0; z-index:100;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
}
.toolbar-title { color:#fff; font-size:18px; font-weight:700; }
.toolbar-sub   { color:#c5cae9; font-size:13px; margin-top:2px; }
.tbtn {
  padding:9px 20px; border:none; border-radius:7px; font-size:14px;
  font-family:'Noto Sans Devanagari',sans-serif; cursor:pointer; font-weight:600;
  background:#ff9800; color:#fff;
}

/* ── Page wrapper ── */
.page-wrap { display:flex; flex-direction:column; align-items:center; padding:30px 20px 60px; gap:28px; }

/* ── Certificate card — matches bonafide-preview.ejs exactly ── */
.certificate {
  background:#fff; width:794px; min-height:1050px; padding:40px 52px;
  box-shadow:0 4px 24px rgba(0,0,0,0.12); border-radius:4px;
  font-family:'Noto Sans Devanagari',sans-serif;
}
.utara-cert { min-height:auto; }

.school-name    { text-align:center; font-size:26px; font-weight:700; margin-bottom:4px; }
.school-address { text-align:center; font-size:15px; font-weight:700; margin-bottom:14px; }
.divider-double { border:none; border-bottom:4px double #000; margin-bottom:20px; }
.cert-title     { text-align:center; font-size:30px; font-weight:700; margin-bottom:24px; text-decoration:underline; }

/* Aadhar / UDISE field row */
.field-row {
  display:grid; grid-template-columns:120px 14px 1fr;
  font-size:15px; font-weight:700; line-height:2.2;
}
.field-row span:nth-child(2) { text-align:center; }
.field-row span:nth-child(3) { border-bottom:1.5px solid #000; padding-left:6px; }

/* Body text paragraphs */
.body-text       { font-size:15px; font-weight:700; line-height:2.4; margin-top:8px; }
.body-text p     { margin:0; }
.uline           { display:inline-block; border-bottom:1.5px solid #000; min-width:80px; }

/* Date row */
.date-row {
  display:grid; grid-template-columns:75px 14px 1fr;
  margin-top:28px; font-size:15px; font-weight:700; line-height:2;
}
.date-row span:nth-child(2) { text-align:center; }
.date-row span:nth-child(3) { border-bottom:1.5px solid #000; max-width:200px; padding-left:6px; }

/* Signature block */
.sig-row   { display:flex; justify-content:space-between; margin-top:40px; }
.sig-block { width:45%; }
.sig-space { height:80px; display:flex; align-items:flex-end; padding-bottom:4px; }
.stamp-img { height:80px; width:auto; object-fit:contain; }
.sig-line  { border-top:2px solid #000; padding-top:4px; font-size:14px; font-weight:700; }
.sig-block.right .sig-line  { text-align:right; }
.sig-block.right .sig-space { justify-content:flex-end; }

/* Utara boxes */
.boxes-row { display:flex; gap:20px; margin:10px 0 14px; }
.blbl { font-size:11px; font-weight:700; border:1.5px solid #000; border-bottom:none; padding:2px 4px; text-align:center; background:#f5f5f5; }
.br   { display:flex; }
.bc   { width:22px; height:25px; border:1.5px solid #000; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; }

/* Utara table */
.ut    { width:100%; border-collapse:collapse; margin-top:6px; }
.ut td { font-size:13px; padding:2px 3px; vertical-align:middle; line-height:1.9; }
.ul    { width:220px; font-weight:700; white-space:nowrap; }
.uc    { width:14px; text-align:center; }
.uv    { border-bottom:1.5px solid #000; padding-left:6px; }
.sub   { font-size:12px; color:#444; }

/* Print */
@page { size:A4 portrait; margin:18mm 16mm; }
@media print {
  html, body { background:#fff !important; margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .toolbar   { display:none !important; }
  .page-wrap { padding:0 !important; gap:0 !important; background:transparent !important; }
  .certificate {
    width:100% !important; box-shadow:none !important; border-radius:0 !important;
    padding:0 !important; min-height:0 !important;
    page-break-after:always; break-after:page;
  }
  .certificate.last { page-break-after:auto; break-after:auto; }
}
</style>
</head>
<body>
<div class="toolbar">
  <div>
    <div class="toolbar-title">📄 ${typeLabel} — ${students.length} विद्यार्थी</div>
    <div class="toolbar-sub">Browser → Print → Save as PDF</div>
  </div>
  <button class="tbtn" onclick="window.print()">🖨️ Print / Save as PDF</button>
</div>
<div class="page-wrap">
${pages.join('\n')}
</div>
</body>
</html>`;
};

// Keep the old name for backward compat — returns a DOCX buffer
const generateBulkPDF = generateBulkDOCX;

module.exports = { generateBulkPDF, generateBulkDOCX, generateBulkHTML };
