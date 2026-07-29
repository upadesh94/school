require('dotenv').config();
require('../config/db'); // Initialize Firebase
const Admin = require('../models/Admin');

const testLogin = async () => {
  try {
    const loginId = 'principle@gmial.com';
    const password = '123123';
    
    let admin = await Admin.findOne({ email: loginId });
    if (!admin) {
        console.log('Not found by email, trying username');
        admin = await Admin.findOne({ username: loginId });
    }
    
    if (!admin) {
        console.log('Admin not found in DB');
        process.exit(1);
    }
    console.log('Admin found:', admin.email);
    
    const isMatch = await admin.comparePassword(password);
    console.log('Password match:', isMatch);
    
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
};

setTimeout(testLogin, 1000);
