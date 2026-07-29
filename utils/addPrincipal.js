require('dotenv').config();
require('../config/db'); // Initialize Firebase
const Admin = require('../models/Admin');

const addPrincipal = async () => {
  try {
    console.log('Checking if principal exists...');
    const exists = await Admin.findOne({ email: 'principle@gmial.com' });
    
    if (exists) {
      console.log('✅ Principal already exists in Firebase!');
      console.log(exists);
    } else {
      console.log('Creating principal...');
      const newAdmin = await Admin.create({
        username: 'principal',
        email: 'principle@gmial.com',
        password: '123123',
        name: 'Principal',
        role: 'admin'
      });
      console.log('✅ Principal added successfully to the "admins" collection!');
      console.log(newAdmin);
    }
    
    // Also add a dummy teacher and student to create their collections
    const Teacher = require('../models/Teacher');
    const Student = require('../models/Student');
    
    const teacherExists = await Teacher.findOne({ email: 'dummy@teacher.com' });
    if (!teacherExists) {
        await Teacher.create({
            name: 'Dummy Teacher',
            email: 'dummy@teacher.com',
            password: 'password123',
            role: 'teacher'
        });
        console.log('✅ "teachers" collection created with dummy data.');
    }
    
    const studentExists = await Student.findOne({ name: 'Dummy Student' });
    if (!studentExists) {
        await Student.create({
            name: 'Dummy Student',
            currentClass: '10th',
            enrollmentId: 'TVV2499999'
        });
        console.log('✅ "students" collection created with dummy data.');
    }
    
    console.log('\nAll requested collections (admins, teachers, students) are now created in Firebase!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding principal:', err);
    process.exit(1);
  }
};

// Add a slight delay to ensure Firebase initializes properly
setTimeout(addPrincipal, 1000);
