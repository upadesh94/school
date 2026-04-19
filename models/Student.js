const { FirestoreModel } = require('../config/db');

class Student extends FirestoreModel {
  static collectionName() {
    return 'students';
  }

  static defaults() {
    return {
      enrollmentId: '',
      saralId: '',
      udiseNo: '',
      rollNo: '',
      name: '',
      aadharNo: '',
      dateOfBirth: null,
      dateOfBirthInWords: '',
      gender: '',
      nationality: 'भारतीय',
      religion: '',
      caste: '',
      category: 'सर्वसाधारण',
      motherTongue: 'मराठी',
      birthPlace: '',
      fatherName: '',
      motherName: '',
      guardianName: '',
      parentContact: '',
      parentEmail: '',
      address: '',
      currentClass: '',
      currentSection: '',
      admissionClass: '',
      admissionDate: null,
      academicYear: '',
      previousSchool: '',
      leavingClass: '',
      leavingDate: null,
      reasonForLeaving: '',
      remarks: '',
      generalConduct: 'चांगले',
      photo: '',
      addedBy: null,
      lastUpdatedBy: null,
      bonafideGenerated: false,
      bonafideGeneratedAt: null,
      utaraGenerated: false,
      utaraGeneratedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  static refs() {
    return {
      addedBy: { model: () => require('./Teacher') },
      lastUpdatedBy: { model: () => require('./Teacher') },
    };
  }

  static async beforeSave(doc) {
    doc.name = String(doc.name || '').trim();
    doc.currentClass = String(doc.currentClass || '').trim();

    if (doc.isNew && !doc.enrollmentId) {
      const count = await this.countDocuments();
      const year = new Date().getFullYear().toString().slice(-2);
      doc.enrollmentId = `TVV${year}${String(count + 1).padStart(5, '0')}`;
    }

    if (doc.enrollmentId) {
      await this.ensureUnique('enrollmentId', doc.enrollmentId, doc._id);
    }
  }
}

module.exports = Student;
