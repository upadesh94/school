const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, VerticalAlign, UnderlineType, ImageRun
} = require('docx');
const fs   = require('fs');
const path = require('path');

const SCHOOL_MARATHI = 'तुलजाभवानी माध्यमिक विद्यालय';
const SCHOOL_ADDRESS = 'वासुसायगाव, ता. गंगापूर';

const fmt  = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
const TODAY = () => new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'});

const NB   = { style: BorderStyle.NONE, size:0, color:'FFFFFF' };
const NBS  = { top:NB, bottom:NB, left:NB, right:NB };
const BBOT = { top:NB, left:NB, right:NB, bottom:{ style:BorderStyle.SINGLE, size:6, color:'000000' } };
const BTOP = { top:{ style:BorderStyle.SINGLE, size:6, color:'000000' }, bottom:NB, left:NB, right:NB };
const BOX  = { style:BorderStyle.SINGLE, size:6, color:'000000' };

const mr = (text, o={}) => new TextRun({ text, font:'Noto Sans Devanagari', size:o.size||22, bold:o.bold||false, underline:o.underline });

const getStamp = () => {
  const p = path.join(__dirname,'../public/images/stamp.png');
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
};

// Stamp paragraph helper
const stampPara = (align=AlignmentType.RIGHT, w=170, h=100) => {
  const buf = getStamp();
  if (!buf) return new Paragraph({ children:[] });
  return new Paragraph({
    alignment: align,
    children: [new ImageRun({ data:buf, transformation:{ width:w, height:h }, type:'png' })]
  });
};

const lbl = (text, w) => new TableCell({
  width:{ size:w, type:WidthType.DXA }, borders:NBS,
  margins:{ top:60, bottom:60, left:0, right:60 },
  children:[new Paragraph({ children:[mr(text,{bold:true})] })]
});
const colon = () => new TableCell({
  width:{ size:200, type:WidthType.DXA }, borders:NBS,
  margins:{ top:60, bottom:60, left:0, right:0 },
  children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[mr(':',{bold:true})] })]
});
const val = (text, w) => new TableCell({
  width:{ size:w, type:WidthType.DXA }, borders:NBS,
  margins:{ top:60, bottom:60, left:80, right:0 },
  children:[new Paragraph({ border:BBOT, children:[mr(text||'')] })]
});
const fRow = (label, value, lw, vw) => new TableRow({
  height:{ value:440, rule:'atLeast' },
  children:[lbl(label,lw), colon(), val(value,vw)]
});

// ═══════════════════════════════════════════════════════
// BONAFIDE
// ═══════════════════════════════════════════════════════
const generateBonafideDocx = async (student) => {
  const classStr = (student.currentClass||'')+(student.currentSection?' '+student.currentSection:'');
  const doc = new Document({
    sections:[{
      properties:{ page:{ size:{ width:11906, height:16838 }, margin:{ top:1440, bottom:1440, left:1440, right:1440 } } },
      children:[
        new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ after:40 }, children:[mr(SCHOOL_MARATHI,{bold:true,size:36})] }),
        new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ after:160 }, children:[mr(SCHOOL_ADDRESS,{bold:true,size:26})] }),
        new Paragraph({ border:{ bottom:{ style:BorderStyle.DOUBLE, size:8, color:'000000', space:1 } }, spacing:{ after:280 }, children:[] }),
        new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:120, after:320 },
          children:[mr('बोनाफाईड सर्टिफिकेट',{bold:true,size:40,underline:{ type:UnderlineType.SINGLE }})] }),

        // Aadhar — tight columns
        new Table({
          width:{ size:9026, type:WidthType.DXA }, columnWidths:[1600,200,7226],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[ fRow('आधार नं.', student.aadharNo||'', 1600, 7226) ]
        }),

        new Paragraph({ spacing:{ before:120, after:0, line:480 },
          children:[mr('देण्यात   येते   की,   ',{bold:true,size:24}), mr(student.name||'',{bold:true,size:24,underline:{type:UnderlineType.SINGLE}})] }),
        new Paragraph({ spacing:{ after:0, line:480 },
          children:[mr('हा  /  ही   या   शाळेचा   विद्यार्थी   /   विद्यार्थिनी   असून   शैक्षणिक   वर्ष   (   ',{bold:true,size:24}), mr(student.academicYear||'',{bold:true,size:24,underline:{type:UnderlineType.SINGLE}}), mr('   )   मध्ये        ',{bold:true,size:24})] }),
        new Paragraph({ spacing:{ after:0, line:480 },
          children:[mr(classStr,{bold:true,size:24,underline:{type:UnderlineType.SINGLE}}), mr('   वर्गात    शिक्षण   घेत   आहे.   /   होता.   शाळेच्या    जनरल    रजिस्टर    नुसार   त्याची    ',{bold:true,size:24})] }),
        new Paragraph({ spacing:{ after:0, line:480 },
          children:[mr('जन्म   तारीख    (अंकी)   ',{bold:true,size:24}), mr(fmt(student.dateOfBirth),{bold:true,size:24,underline:{type:UnderlineType.SINGLE}}), mr('    (अक्षरी)   ',{bold:true,size:24}), mr(student.dateOfBirthInWords||'',{bold:true,size:24,underline:{type:UnderlineType.SINGLE}})] }),
        new Paragraph({ spacing:{ after:0, line:480 },
          children:[mr('_________________________________________________________________________  ही असू',{bold:true,size:24})] }),
        new Paragraph({ spacing:{ after:0, line:480 },
          children:[mr('जात  ',{bold:true,size:24}), mr(student.caste||'',{bold:true,size:24,underline:{type:UnderlineType.SINGLE}}), mr('  ही   आहे.   तसेच   सदर  विद्यार्थ्यांची  वर्तणूक  चांगली  आहे.',{bold:true,size:24})] }),

        new Table({
          width:{ size:9026, type:WidthType.DXA }, columnWidths:[1400,200,7426],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[ fRow('दिनांक', TODAY(), 1400, 7426) ]
        }),
        new Paragraph({ spacing:{ before:400 }, children:[] }),

        // Signature block
        new Table({
          width:{ size:9026, type:WidthType.DXA }, columnWidths:[4513,4513],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[
            new TableRow({ children:[
              new TableCell({ width:{ size:4513, type:WidthType.DXA }, borders:NBS,
                children:[
                  new Paragraph({ children:[] }), new Paragraph({ children:[] }), new Paragraph({ children:[] }),
                  new Paragraph({ border:BTOP, children:[mr('लिपिक',{bold:true,size:22})] })
                ]
              }),
              new TableCell({ width:{ size:4513, type:WidthType.DXA }, borders:NBS,
                children:[
                  new Paragraph({ children:[] }),
                  stampPara(AlignmentType.RIGHT, 170, 100),
                  new Paragraph({ border:BTOP, alignment:AlignmentType.RIGHT, children:[mr('मुख्याध्यापक / प्राचार्य',{bold:true,size:22})] })
                ]
              })
            ]})
          ]
        })
      ]
    }]
  });
  return Packer.toBuffer(doc);
};

// ═══════════════════════════════════════════════════════
// UTARA
// ═══════════════════════════════════════════════════════
const generateUtaraDocx = async (student) => {
  const aadharStr = (student.aadharNo||'').replace(/\s/g,'');
  const saralStr  = student.saralId||'';

  const makeBoxRow = (str, count) => {
    const arr = (str+' '.repeat(count)).slice(0,count).split('');
    return new TableRow({ children: arr.map(ch => new TableCell({
      width:{ size:300, type:WidthType.DXA },
      borders:{ top:BOX, bottom:BOX, left:BOX, right:BOX },
      margins:{ top:20, bottom:20, left:10, right:10 },
      children:[new Paragraph({ alignment:AlignmentType.CENTER, children:[mr(ch.trim(),{size:18})] })]
    }))});
  };

  // Saral: 19 boxes × 300 DXA = 5700; Aadhar: 12 × 300 = 3600
  const saralBoxTable = new Table({
    width:{ size:5700, type:WidthType.DXA },
    columnWidths: Array(19).fill(300),
    borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
    rows:[ makeBoxRow(saralStr, 19) ]
  });
  const aadharBoxTable = new Table({
    width:{ size:3600, type:WidthType.DXA },
    columnWidths: Array(12).fill(300),
    borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
    rows:[ makeBoxRow(aadharStr, 12) ]
  });

  // Field 17 stamp
  const stampBuf = getStamp();
  const field17Val = new TableCell({
    width:{ size:7346, type:WidthType.DXA }, borders:NBS,
    margins:{ top:60, bottom:60, left:80, right:0 },
    children: stampBuf
      ? [new Paragraph({ children:[new ImageRun({ data:stampBuf, transformation:{ width:170, height:100 }, type:'png' })] })]
      : [new Paragraph({ border:BBOT, children:[mr('')] })]
  });

  const doc = new Document({
    sections:[{
      properties:{ page:{ size:{ width:11906, height:16838 }, margin:{ top:900, bottom:900, left:1080, right:1080 } } },
      children:[
        // School name
        new Paragraph({ spacing:{ after:80 }, children:[mr('शाळेचे नाव : '+SCHOOL_MARATHI+', '+SCHOOL_ADDRESS,{bold:true,size:22})] }),
        // Title — NO dash
        new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ after:120 },
          children:[mr('प्रवेश  व  निर्गम  रजिस्टर  उतारा',{bold:true,size:34,underline:{type:UnderlineType.SINGLE}})] }),

        // UDISE row — full width
        new Table({
          width:{ size:10746, type:WidthType.DXA }, columnWidths:[2200,200,8346],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[ fRow('युडायस नंबर', student.udiseNo||'', 2200, 8346) ]
        }),

        new Paragraph({ spacing:{ after:60 }, children:[] }),

        // Saral + Aadhar boxes SIDE BY SIDE — in a 2-col table below UDISE
        new Table({
          width:{ size:10746, type:WidthType.DXA },
          columnWidths:[5800, 4946],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[
            new TableRow({ children:[
              // Saral column
              new TableCell({ width:{ size:5800, type:WidthType.DXA }, borders:NBS,
                margins:{ top:0, bottom:0, left:0, right:40 },
                children:[
                  new Paragraph({ children:[mr('सरल आय. डि. नं',{bold:true,size:20})] }),
                  saralBoxTable
                ]
              }),
              // Aadhar column
              new TableCell({ width:{ size:4946, type:WidthType.DXA }, borders:NBS,
                margins:{ top:0, bottom:0, left:40, right:0 },
                children:[
                  new Paragraph({ children:[mr('आधार नं.',{bold:true,size:20})] }),
                  aadharBoxTable
                ]
              }),
            ]})
          ]
        }),

        new Paragraph({ spacing:{ after:100 }, children:[] }),

        // Main fields
        new Table({
          width:{ size:10746, type:WidthType.DXA }, columnWidths:[3200,200,7346],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[
            fRow('1) प्रवेश क्रमांक', student.enrollmentId||'', 3200, 7346),
            fRow('2) विद्यार्थ्याचे नाव', student.name||'', 3200, 7346),
            fRow('3) आईचे नाव', student.motherName||'', 3200, 7346),
            fRow('4) धर्म व जात', [student.religion,student.caste].filter(Boolean).join(' / '), 3200, 7346),
            fRow('5) मातृभाषा', student.motherTongue||'मराठी', 3200, 7346),
            fRow('6) जन्मस्थळ', student.birthPlace||'', 3200, 7346),
            fRow('7) जन्म दिनांक अंकात', fmt(student.dateOfBirth), 3200, 7346),
            fRow('8) जन्म दिनांक अक्षरात', student.dateOfBirthInWords||'', 3200, 7346),
            fRow('9) पूर्वीची शाळा', student.previousSchool||'', 3200, 7346),
            fRow('    शाळेचे नाव', SCHOOL_MARATHI+', '+SCHOOL_ADDRESS, 3200, 7346),
            fRow('10) वर्ग', (student.currentClass||'')+(student.currentSection?' '+student.currentSection:''), 3200, 7346),
            fRow('11) प्रवेश दिनांक', fmt(student.admissionDate), 3200, 7346),
            fRow('12) प्रवेशाच्या वेळेस वर्ग', student.admissionClass||'', 3200, 7346),
            fRow('13) शाळा सोडताना वर्ग', student.leavingClass||'', 3200, 7346),
            fRow('14) शाळा सोडताना दिनांक', fmt(student.leavingDate), 3200, 7346),
            fRow('15) शाळा सोडण्याचे कारण', student.reasonForLeaving||'', 3200, 7346),
            fRow('16) शेरा', student.remarks||'', 3200, 7346),
            // Field 17 with stamp
            new TableRow({ height:{ value:1500, rule:'atLeast' },
              children:[ lbl('17) मुख्याध्यापकाची स्वाक्षरी', 3200), colon(), field17Val ]
            }),
          ]
        }),

        new Paragraph({ spacing:{ before:300 }, children:[] }),
        // Date only at bottom
        new Table({
          width:{ size:10746, type:WidthType.DXA }, columnWidths:[1400,200,9146],
          borders:{ top:NB, bottom:NB, left:NB, right:NB, insideH:NB, insideV:NB },
          rows:[ fRow('दिनांक', TODAY(), 1400, 9146) ]
        })
      ]
    }]
  });
  return Packer.toBuffer(doc);
};

module.exports = { generateBonafideDocx, generateUtaraDocx };
