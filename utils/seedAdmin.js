require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  await connectDB();
  const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
  if (!exists) {
    await Admin.create({
      username: process.env.ADMIN_USERNAME || 'principal',
      email: process.env.ADMIN_EMAIL || 'principal@riyaschool.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      name: 'Principal'
    });
    console.log('✅ Admin seeded');
  } else {
    console.log('ℹ️  Admin already exists');
  }
  process.exit(0);
};

seedAdmin();
