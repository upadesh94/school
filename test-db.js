require('dotenv').config();
require('./config/db');
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
setTimeout(async () => {
  const admin = await Admin.findOne({ username: 'mukhyadhyapak' });
  console.log('Admin:', admin);
  process.exit(0);
}, 2000);
