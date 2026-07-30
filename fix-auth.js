require('dotenv').config();
require('./config/db');
const Admin = require('./models/Admin');
const { auth } = require('./config/db');
const { createUserWithEmailAndPassword } = require('firebase/auth');

setTimeout(async () => {
  const admin = await Admin.findOne({ username: 'mukhyadhyapak' });
  try {
    await createUserWithEmailAndPassword(auth, admin.email, 'Admin@123');
    console.log('Successfully created Firebase Auth user for:', admin.email);
  } catch (e) {
    console.log('Firebase Auth error or already exists:', e.message);
  }
  process.exit(0);
}, 2000);
