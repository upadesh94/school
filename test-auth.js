const { auth } = require('./config/db');
const { signInWithEmailAndPassword } = require('firebase/auth');

async function test() {
  try {
    const user = await signInWithEmailAndPassword(auth, 'admin@tuljabhavani.edu', 'Admin@123');
    console.log('Success!', user.user.email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message, err.code);
    process.exit(1);
  }
}
setTimeout(test, 2000);
