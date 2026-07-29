const FirebaseModel = require('../utils/firebaseModel');

const studentPreSave = async (doc, isNew) => {
  if (isNew && !doc.enrollmentId) {
    const year = new Date().getFullYear().toString().slice(-2);
    // Simple random enrollment ID generation for Firebase to avoid counting which is slow
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    doc.enrollmentId = `TVV${year}${randomNum}`;
  }
};

class Student extends FirebaseModel {
  constructor() {
    super('students', {}, studentPreSave);
  }
}

module.exports = new Student();
