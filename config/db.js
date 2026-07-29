const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getAuth } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyDtJk97zLgHJKHJHsfJwT50yRcb0t-3eL4",
  authDomain: "office-automation-16ac2.firebaseapp.com",
  projectId: "office-automation-16ac2",
  storageBucket: "office-automation-16ac2.firebasestorage.app",
  messagingSenderId: "617615210410",
  appId: "1:617615210410:web:52f5e1881a6e8e2e651dd3",
  measurementId: "G-1ZNFY88P97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("✅ Firebase Configured");

module.exports = { db, auth, app };
