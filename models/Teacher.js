const bcrypt = require('bcryptjs');
const { FirestoreModel } = require('../config/db');

class Teacher extends FirestoreModel {
  static collectionName() {
    return 'teachers';
  }

  static defaults() {
    return {
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      profilePhoto: '',
      qualification: '',
      subject: '',
      classAssigned: '',
      section: '',
      joiningDate: new Date(),
      address: '',
      dateOfBirth: null,
      gender: '',
      isActive: true,
      role: 'teacher',
      lastLogin: null,
      addedBy: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  static async beforeSave(doc) {
    doc.name = String(doc.name || '').trim();
    doc.email = String(doc.email || '').trim().toLowerCase();

    if (doc.isNew && !doc.employeeId) {
      const count = await this.countDocuments();
      doc.employeeId = `RIS-T${String(count + 1).padStart(4, '0')}`;
    }

    await this.ensureUnique('email', doc.email, doc._id);
    if (doc.employeeId) await this.ensureUnique('employeeId', doc.employeeId, doc._id);

    if (doc.isModified('password')) {
      doc.password = await bcrypt.hash(doc.password, 12);
    }
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

module.exports = Teacher;
