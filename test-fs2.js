require('dotenv').config();
const Admin = require('./models/Admin');
setTimeout(async () => {
  const adminByEmail = await Admin.findOne({ email: 'principle@gmial.com' });
  const adminByUsername = await Admin.findOne({ username: 'principle@gmial.com' });
  console.log('By Email:', adminByEmail);
  console.log('By Username:', adminByUsername);
  process.exit(0);
}, 2000);
