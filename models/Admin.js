const { db } = require('../config/db');
const { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc } = require('firebase/firestore');
const bcrypt = require('bcryptjs');

const adminsCollection = collection(db, 'admins');

class Admin {
  static async findOne(queryObj) {
    let q = query(adminsCollection);
    for (const [key, value] of Object.entries(queryObj)) {
      q = query(q, where(key, '==', value));
    }
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    return { 
      id: docSnap.id, 
      ...data, 
      _id: docSnap.id, 
      comparePassword: async (p) => bcrypt.compare(p, data.password) 
    };
  }

  static async create(data) {
    if (data.password) data.password = await bcrypt.hash(data.password, 12);
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
    const docRef = await addDoc(adminsCollection, data);
    return { id: docRef.id, ...data, _id: docRef.id };
  }

  static async findById(id) {
    const docRef = doc(db, 'admins', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data(), _id: docSnap.id };
  }
}

module.exports = Admin;
