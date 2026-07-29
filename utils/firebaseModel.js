const { db } = require('../config/db');
const { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, deleteDoc, orderBy, limit } = require('firebase/firestore');

class FirebaseModel {
  constructor(collectionName, schema = {}, preSave = null, instanceMethods = {}) {
    this.collectionName = collectionName;
    this.coll = collection(db, collectionName);
    this.schema = schema;
    this.preSave = preSave;
    this.instanceMethods = instanceMethods;
  }

  _formatDoc(docSnap) {
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    const docObj = { id: docSnap.id, _id: docSnap.id, ...data };
    for (const [name, method] of Object.entries(this.instanceMethods)) {
      docObj[name] = method.bind(docObj);
    }
    return docObj;
  }

  async findOne(queryObj = {}) {
    let q = query(this.coll);
    for (const [k, v] of Object.entries(queryObj)) {
      q = query(q, where(k, '==', v));
    }
    const snapshot = await getDocs(query(q, limit(1)));
    if (snapshot.empty) return null;
    return this._formatDoc(snapshot.docs[0]);
  }

  async findById(id) {
    if (!id) return null;
    const docRef = doc(db, this.collectionName, id);
    const snap = await getDoc(docRef);
    return this._formatDoc(snap);
  }

  find(queryObj = {}) {
    let q = query(this.coll);
    for (const [k, v] of Object.entries(queryObj)) {
      q = query(q, where(k, '==', v));
    }
    
    const self = this;
    const chain = {
      _q: q,
      sort: function(sortObj) { return this; },
      populate: function() { return this; },
      limit: function(n) {
        this._q = query(this._q, limit(n));
        return this;
      },
      exec: async function() {
        const snap = await getDocs(this._q);
        return snap.docs.map(d => {
            const data = d.data();
            const docObj = { id: d.id, _id: d.id, ...data };
            docObj.save = async function() {
                const toSave = { ...this };
                delete toSave.id;
                delete toSave._id;
                delete toSave.save;
                await updateDoc(doc(db, self.collectionName, this.id), toSave);
            };
            return docObj;
        });
      },
      then: function(resolve, reject) {
        return this.exec().then(resolve).catch(reject);
      }
    };
    return chain;
  }

  async create(data) {
    const docData = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (this.preSave) {
      await this.preSave(docData, true);
    }
    const ref = await addDoc(this.coll, docData);
    return { id: ref.id, _id: ref.id, ...docData, save: async function() {
      await updateDoc(doc(db, this.collectionName, this.id), this);
    }};
  }

  async findByIdAndUpdate(id, data, options = {}) {
    const docRef = doc(db, this.collectionName, id);
    data.updatedAt = new Date().toISOString();
    await updateDoc(docRef, data);
    if (options.new) {
      return this.findById(id);
    }
    return true; 
  }
  
  async findByIdAndDelete(id) {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
    return true;
  }

  async countDocuments(queryObj = {}) {
    let q = query(this.coll);
    for (const [k, v] of Object.entries(queryObj)) {
      q = query(q, where(k, '==', v));
    }
    const snap = await getDocs(q);
    return snap.size;
  }
}

module.exports = FirebaseModel;
