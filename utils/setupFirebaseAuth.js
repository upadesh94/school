require('dotenv').config();
const { auth } = require('../config/db');
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

const setupAuth = async () => {
  try {
    const email = 'principle@gmial.com';
    const password = '123123';
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ User successfully created in Firebase Auth:', userCredential.user.email);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('User already exists in Firebase Auth, trying to log in...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Successfully logged in to Firebase Auth:', userCredential.user.email);
      } else {
        throw e;
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

setTimeout(setupAuth, 1000);
