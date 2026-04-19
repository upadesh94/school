const bcrypt = require('bcryptjs');
const { FirestoreModel } = require('../config/db');

class Admin extends FirestoreModel {
  static collectionName() {
    return 'admins';
  }

  static defaults() {
    return {
      username: '',
      email: '',
      password: '',
      name: 'Principal',
      phone: '',
      profilePhoto: '',
      role: 'admin',
      lastLogin: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  static async beforeSave(doc) {
    doc.username = String(doc.username || '').trim();
    doc.email = String(doc.email || '').trim().toLowerCase();

    await this.ensureUnique('username', doc.username, doc._id);
    await this.ensureUnique('email', doc.email, doc._id);

    if (doc.isModified('password')) {
      doc.password = await bcrypt.hash(doc.password, 12);
    }
  }

  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

module.exports = Admin;
