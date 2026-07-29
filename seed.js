require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const connectDB = require('./config/db');

const seedAdmin = async () => {
  await connectDB();

  try {
    const existingAdmin = await Admin.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin already exists:', existingAdmin.email);
      process.exit(0);
    }

    const admin = await Admin.create({
      username: process.env.ADMIN_USERNAME || 'principal',
      email: process.env.ADMIN_EMAIL || 'principal@riyaschool.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      name: 'Principal',
      phone: process.env.SCHOOL_CONTACT || '9576558205',
      role: 'admin',
    });

    console.log('✅ Default Admin Created:');
    console.log(`   Username : ${admin.username}`);
    console.log(`   Email    : ${admin.email}`);
    console.log(`   Password : ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
    console.log('\n⚠️  Please login and change the password immediately!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedAdmin();
