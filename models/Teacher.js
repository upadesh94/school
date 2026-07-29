const FirebaseModel = require('../utils/firebaseModel');
const bcrypt = require('bcryptjs');

const teacherPreSave = async (doc) => {
  if (doc.password) {
    doc.password = await bcrypt.hash(doc.password, 12);
  }
};

const instanceMethods = {
  comparePassword: async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }
};

class Teacher extends FirebaseModel {
  constructor() {
    super('teachers', {}, teacherPreSave, instanceMethods);
  }
}

module.exports = new Teacher();
