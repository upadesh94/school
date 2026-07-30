require('dotenv').config();
const Admin = require('./models/Admin');
setTimeout(async () => {
  const admin = await Admin.findOne({ username: 'mukhyadhyapak' });
  console.log('Admin in Firestore:', admin);
  process.exit(0);
}, 2000);
