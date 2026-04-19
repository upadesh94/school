/**
 * excelParser.js — Bulletproof parser for Namoona Excel template.
 *
 * Template structure:
 *   Row 1 — Column headers (color-coded)
 *   Row 2 — Required-for labels (★ / ◆ / ◇ / ○)  ← SKIP
 *   Row 3 — Legend text                             ← SKIP
 *   Row 4+ — Actual student data
 *
 * Uses header:1 (raw arrays) so it finds the real header row itself.
 */

const XLSX = require('xlsx');

const norm = (s) =>
  s ? String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, '') : '';

// Exact normalized keys from the Namoona template + common fallbacks
const COLUMN_MAP = {
  'प्रवेशक्रमांकenrollmentid':            'enrollmentId',
  'प्रवेशक्रमांक':                         'enrollmentId',
  'enrollmentid':                            'enrollmentId',
  'enrollmentno':                            'enrollmentId',

  'सरलआयडिनंsaralid':                     'saralId',
  'सरलआयडिनं':                            'saralId',
  'saralid':                                'saralId',
  'saral':                                  'saralId',

  'युडायसनंबरudiseno':                     'udiseNo',
  'युडायसनंबर':                            'udiseNo',
  'udiseno':                                'udiseNo',
  'udise':                                  'udiseNo',

  'आधारनंaadharno':                        'aadharNo',
  'आधारनं':                                'aadharNo',
  'aadharno':                               'aadharNo',
  'aadhar':                                 'aadharNo',
  'aadharnumber':                           'aadharNo',

  'क्रमांकrollno':                         'rollNo',
  'क्रमांक':                               'rollNo',
  'rollno':                                 'rollNo',
  'roll':                                   'rollNo',
  'srno':                                   'rollNo',

  // STUDENT NAME — exact template key is just Marathi (no English)
  'विद्यार्थ्याचेसंपूर्णनाव':            'name',
  'विद्यार्थ्याचेसंपूर्णनावstudentfullname': 'name',
  'studentfullname':                         'name',
  'studentname':                             'name',
  'name':                                    'name',

  'लिंगgender':                            'gender',
  'लिंग':                                  'gender',
  'gender':                                 'gender',
  'sex':                                    'gender',

  // DOB — exact key from template is 'जन्मदिनांकddmmyyyy'
  'जन्मदिनांकddmmyyyy':                   'dateOfBirth',
  'जन्मदिनांकddmmyyyydateofbirth':        'dateOfBirth',
  'जन्मदिनांक':                           'dateOfBirth',
  'dateofbirth':                            'dateOfBirth',
  'dob':                                    'dateOfBirth',
  'birthdate':                              'dateOfBirth',

  // DOB in words — exact key: 'जन्मदिनांकअक्षरी'
  'जन्मदिनांकअक्षरी':                    'dateOfBirthInWords',
  'जन्मदिनांकअक्षरीdobinmarathiwords':   'dateOfBirthInWords',
  'dobinmarathiwords':                      'dateOfBirthInWords',
  'dateofbirthinwords':                     'dateOfBirthInWords',
  'dobwords':                               'dateOfBirthInWords',

  'जन्मस्थळbirthplace':                   'birthPlace',
  'जन्मस्थळ':                             'birthPlace',
  'birthplace':                             'birthPlace',

  'राष्ट्रीयत्वnationality':             'nationality',
  'राष्ट्रीयत्व':                        'nationality',
  'nationality':                            'nationality',

  'धर्मreligion':                         'religion',
  'धर्म':                                 'religion',
  'religion':                               'religion',

  'जातcaste':                             'caste',
  'जात':                                  'caste',
  'caste':                                 'caste',

  'प्रवर्गcategory':                      'category',
  'प्रवर्ग':                              'category',
  'category':                              'category',

  'मातृभाषाmothertongue':                'motherTongue',
  'मातृभाषा':                            'motherTongue',
  'mothertongue':                          'motherTongue',

  // exact: 'सर्वसाधारणवर्तणूकconduct'
  'सर्वसाधारणवर्तणूकconduct':           'generalConduct',
  'सर्वसाधारणवर्तणूकgeneralconduct':    'generalConduct',
  'सर्वसाधारणवर्तणूक':                 'generalConduct',
  'generalconduct':                        'generalConduct',
  'conduct':                               'generalConduct',

  // exact: 'वडिलांचेनावfathername'
  'वडिलांचेनावfathername':               'fatherName',
  'वडिलांचेनाव':                         'fatherName',
  'fathersname':                           'fatherName',
  'fathername':                            'fatherName',
  'father':                                'fatherName',

  // exact: 'आईचेनावmothername'
  'आईचेनावmothername':                    'motherName',
  'आईचेनाव':                              'motherName',
  'mothersname':                           'motherName',
  'mothername':                            'motherName',
  'mother':                                'motherName',

  'पालकाचेनावguardianname':              'guardianName',
  'पालकाचेनाव':                          'guardianName',
  'guardianname':                          'guardianName',
  'guardian':                              'guardianName',

  // exact: 'पालकाचासंपर्कphone'
  'पालकाचासंपर्कphone':                  'parentContact',
  'पालकाचासंपर्कparentcontact':         'parentContact',
  'पालकाचासंपर्क':                      'parentContact',
  'parentcontact':                         'parentContact',
  'phone':                                 'parentContact',
  'mobile':                                'parentContact',
  'contact':                               'parentContact',

  // exact: 'पालकाचाईमेलemail'
  'पालकाचाईमेलemail':                    'parentEmail',
  'पालकाचाईमेलparentemail':             'parentEmail',
  'पालकाचाईमेल':                        'parentEmail',
  'parentemail':                           'parentEmail',
  'email':                                 'parentEmail',

  'पत्ताaddress':                         'address',
  'पत्ता':                                'address',
  'address':                               'address',

  // CURRENT CLASS — exact: 'वर्तमानवर्गcurrentclass'
  'वर्तमानवर्गcurrentclass':             'currentClass',
  'वर्तमानवर्ग':                         'currentClass',
  'currentclass':                          'currentClass',
  'class':                                 'currentClass',
  'वर्ग':                                'currentClass',

  'तुकडीsection':                        'currentSection',
  'तुकडी':                               'currentSection',
  'section':                               'currentSection',

  'शैक्षणिकवर्षacademicyear':           'academicYear',
  'शैक्षणिकवर्ष':                       'academicYear',
  'academicyear':                          'academicYear',

  'प्रवेशदिनांकadmissiondate':          'admissionDate',
  'प्रवेशदिनांक':                       'admissionDate',
  'admissiondate':                         'admissionDate',
  'dateofadmission':                       'admissionDate',

  // exact: 'प्रवेशाच्यावेळेसवर्गadmissionclass'
  'प्रवेशाच्यावेळेसवर्गadmissionclass': 'admissionClass',
  'प्रवेशाच्यावेळेसवर्ग':              'admissionClass',
  'classatadmission':                      'admissionClass',
  'admissionclass':                        'admissionClass',

  'पूर्वीचीशाळाpreviousschool':         'previousSchool',
  'पूर्वीचीशाळा':                       'previousSchool',
  'previousschool':                        'previousSchool',

  'शाळासोडतानावर्गleavingclass':        'leavingClass',
  'शाळासोडतानावर्ग':                    'leavingClass',
  'leavingclass':                          'leavingClass',

  'शाळासोडतानादिनांकleavingdate':       'leavingDate',
  'शाळासोडतानादिनांक':                  'leavingDate',
  'leavingdate':                           'leavingDate',
  'dateofleaving':                         'leavingDate',

  'शाळासोडण्याचेकारणreasonforleaving':  'reasonForLeaving',
  'शाळासोडण्याचेकारण':                'reasonForLeaving',
  'reasonforleaving':                      'reasonForLeaving',
  'reason':                                'reasonForLeaving',

  'शेराremarks':                         'remarks',
  'शेरा':                                'remarks',
  'remarks':                               'remarks',
};

const DATE_FIELDS = new Set(['dateOfBirth', 'admissionDate', 'leavingDate']);

const parseDate = (val) => {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) return new Date(d.y, d.m - 1, d.d);
    } catch (e) { /* fall through */ }
  }
  const s = String(val).trim();
  if (!s) return undefined;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

const isLabelRow = (nameCell) => {
  if (!nameCell && nameCell !== 0) return true;
  const s = String(nameCell).trim();
  if (!s) return true;
  return ['★','◆','◇','○','LEGEND','legend'].some(p => s.startsWith(p));
};

const parseExcelToStudents = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const allRows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

    if (!allRows.length) {
      return { success: false, error: 'Excel फाइल रिकामी आहे. नमुना डाउनलोड करून भरा.' };
    }

    // Find header row: first row where 3+ cells match known column keys
    let headerRowIdx    = -1;
    let colIndexToField = {};

    for (let ri = 0; ri < Math.min(allRows.length, 8); ri++) {
      const row       = allRows[ri];
      const candidate = {};
      let   matched   = 0;
      for (let ci = 0; ci < row.length; ci++) {
        if (!row[ci]) continue;
        const field = COLUMN_MAP[norm(String(row[ci]))];
        if (field !== undefined) { candidate[ci] = field; matched++; }
      }
      if (matched >= 3) {
        headerRowIdx    = ri;
        colIndexToField = candidate;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return {
        success: false,
        error: 'Excel मध्ये ओळखता येण्याजोगे column headers सापडले नाहीत. कृपया नमुना template वापरा.',
      };
    }

    // Find the column index for 'name' field (for skip-row detection)
    let nameColIdx = -1;
    for (const [ci, field] of Object.entries(colIndexToField)) {
      if (field === 'name') { nameColIdx = parseInt(ci); break; }
    }

    const students  = [];
    const rowErrors = [];
    let   dataCount = 0;

    for (let ri = headerRowIdx + 1; ri < allRows.length; ri++) {
      const row    = allRows[ri];
      const rowNum = ri + 1;

      if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

      // Skip label/legend rows
      if (nameColIdx >= 0 && isLabelRow(row[nameColIdx])) continue;
      // Also skip if first non-empty cell starts with ★ etc
      const firstVal = row.find(c => c !== '' && c !== null && c !== undefined);
      if (firstVal && isLabelRow(firstVal)) continue;

      const student = {};
      for (const [ci, field] of Object.entries(colIndexToField)) {
        const raw = row[parseInt(ci)];
        if (raw === null || raw === undefined || raw === '') continue;
        if (DATE_FIELDS.has(field)) {
          const d = parseDate(raw);
          if (d) student[field] = d;
        } else {
          const s = String(raw).trim();
          if (s) student[field] = s;
        }
      }

      const name = student.name || '';
      const cls  = student.currentClass || '';
      if (!name && !cls) continue;

      dataCount++;

      if (!name) { rowErrors.push(`ओळ ${rowNum}: नाव रिकामे — वगळले`); continue; }
      if (!cls)  { rowErrors.push(`ओळ ${rowNum} "${name}": वर्ग रिकामा — वगळले`); continue; }

      students.push(student);
    }

    if (dataCount === 0) {
      return {
        success: false,
        error: 'Excel मध्ये data rows आढळले नाहीत. Row 4 पासून विद्यार्थ्यांची माहिती भरा.',
      };
    }

    return { success: true, students, total: students.length,
             skipped: dataCount - students.length, rowErrors };

  } catch (err) {
    return { success: false, error: 'फाइल वाचताना त्रुटी: ' + err.message };
  }
};

module.exports = { parseExcelToStudents };
