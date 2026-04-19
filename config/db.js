const admin = require('firebase-admin');
const path = require('path');

let initialized = false;
let firestoreInstance = null;

function buildClientFirestoreAdapter(clientDb, fs) {
  return {
    collection: (name) => ({
      doc: (id) => {
        const collectionRef = fs.collection(clientDb, name);
        const docRef = id ? fs.doc(clientDb, name, id) : fs.doc(collectionRef);
        return {
          id: docRef.id,
          async get() {
            const snap = await fs.getDoc(docRef);
            return {
              exists: snap.exists(),
              id: snap.id,
              data: () => snap.data(),
            };
          },
          async set(data, options = {}) {
            await fs.setDoc(docRef, data, options);
          },
          async delete() {
            await fs.deleteDoc(docRef);
          },
        };
      },
      async get() {
        const querySnap = await fs.getDocs(fs.collection(clientDb, name));
        return {
          docs: querySnap.docs.map((snap) => ({
            id: snap.id,
            data: () => snap.data(),
          })),
        };
      },
    }),
  };
}

function initFirebase() {
  if (initialized) return firestoreInstance;

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const hasWebConfig = Boolean(
    process.env.FIREBASE_API_KEY &&
    process.env.FIREBASE_AUTH_DOMAIN &&
    process.env.FIREBASE_PROJECT_ID
  );

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      const serviceAccount = require(keyPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }

    firestoreInstance = admin.firestore();
    initialized = true;
    console.log('✅ Firebase Admin initialized');
    return firestoreInstance;
  } catch (adminErr) {
    if (!hasWebConfig) throw adminErr;

    try {
      const { initializeApp } = require('firebase/app');
      const fs = require('firebase/firestore');

      const app = initializeApp({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
      });

      const clientDb = fs.getFirestore(app);
      firestoreInstance = buildClientFirestoreAdapter(clientDb, fs);
      initialized = true;
      console.log('✅ Firebase Client initialized (fallback)');
      return firestoreInstance;
    } catch (clientErr) {
      throw new Error(`Admin init failed: ${adminErr.message}. Client init failed: ${clientErr.message}`);
    }
  }
}

function getFirestore() {
  return initFirebase();
}

function toDate(value) {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function serialize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const s = serialize(val);
      if (s !== undefined) out[key] = s;
    }
    return out;
  }
  return value;
}

function matchCondition(docValue, condition) {
  if (condition instanceof RegExp) return condition.test(String(docValue || ''));
  return docValue === condition;
}

function matchFilter(doc, filter = {}) {
  if (!filter || Object.keys(filter).length === 0) return true;
  if (Array.isArray(filter.$or)) {
    const orMatch = filter.$or.some((sub) => matchFilter(doc, sub));
    if (!orMatch) return false;
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') continue;
    if (!matchCondition(doc[key], value)) return false;
  }
  return true;
}

function applySort(list, sortSpec = {}) {
  const keys = Object.keys(sortSpec || {});
  if (!keys.length) return list;
  return [...list].sort((left, right) => {
    for (const key of keys) {
      const direction = sortSpec[key] >= 0 ? 1 : -1;
      const a = left[key];
      const b = right[key];
      if (a == null && b == null) continue;
      if (a == null) return -1 * direction;
      if (b == null) return 1 * direction;
      if (a > b) return 1 * direction;
      if (a < b) return -1 * direction;
    }
    return 0;
  });
}

class FirestoreQuery {
  constructor(modelClass, filter = {}, options = {}) {
    this.modelClass = modelClass;
    this.filter = filter || {};
    this.single = !!options.single;
    this.findOne = !!options.findOne;
    this.byId = options.byId || null;
    this.sortSpec = null;
    this.limitCount = null;
    this.selectSpec = null;
    this.populateSpecs = [];
  }

  sort(spec) { this.sortSpec = spec; return this; }
  limit(count) { this.limitCount = Number(count); return this; }
  select(spec) { this.selectSpec = spec; return this; }
  populate(pathName, select) { this.populateSpecs.push({ pathName, select }); return this; }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }

  async exec() {
    let docs = [];
    const collection = this.modelClass.collection();
    if (this.byId) {
      const snap = await collection.doc(this.byId).get();
      if (!snap.exists) return null;
      docs = [this.modelClass.fromFirestore(snap.id, snap.data())];
    } else {
      const snap = await collection.get();
      docs = snap.docs
        .map((d) => this.modelClass.fromFirestore(d.id, d.data()))
        .filter((doc) => matchFilter(doc, this.filter));
    }

    if (this.sortSpec) docs = applySort(docs, this.sortSpec);
    if (this.findOne && !this.sortSpec && docs.length > 1) docs = docs.slice(0, 1);
    if (Number.isInteger(this.limitCount) && this.limitCount >= 0) docs = docs.slice(0, this.limitCount);

    if (this.populateSpecs.length) {
      for (const pop of this.populateSpecs) {
        await this.modelClass.populateDocuments(docs, pop.pathName, pop.select);
      }
    }
    if (this.selectSpec) docs = docs.map((doc) => this.modelClass.applySelect(doc, this.selectSpec));

    if (this.single || this.findOne || this.byId) return docs[0] || null;
    return docs;
  }
}

class FirestoreModel {
  constructor(data = {}) {
    Object.assign(this, this.constructor.defaults(), data);
    this._id = data._id || data.id || null;
    this.isNew = !this._id;
    this._snapshot = this.toObject();
  }

  static collectionName() { throw new Error('collectionName() must be implemented'); }
  static defaults() { return {}; }
  static refs() { return {}; }
  static collection() { return getFirestore().collection(this.collectionName()); }

  static fromFirestore(id, data = {}) {
    const normalized = {};
    for (const [key, value] of Object.entries(data || {})) normalized[key] = toDate(value);
    const doc = new this({ _id: id, ...normalized });
    doc.isNew = false;
    doc._snapshot = doc.toObject();
    return doc;
  }

  toObject() {
    const output = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'function') continue;
      output[key] = value;
    }
    output._id = this._id;
    return output;
  }

  isModified(field) { return this.isNew || this._snapshot[field] !== this[field]; }

  async save() {
    if (typeof this.constructor.beforeSave === 'function') {
      await this.constructor.beforeSave(this);
    }

    const now = new Date();
    if (!this.createdAt) this.createdAt = now;
    this.updatedAt = now;
    if (!this._id) {
      this._id = this.constructor.collection().doc().id;
      this.isNew = true;
    }

    const payload = serialize(this.toObject());
    delete payload._id;
    await this.constructor.collection().doc(this._id).set(payload, { merge: true });
    this.isNew = false;
    this._snapshot = this.toObject();
    return this;
  }

  static async create(data) { const doc = new this(data); await doc.save(); return doc; }
  static find(filter = {}) { return new FirestoreQuery(this, filter, { single: false }); }
  static findOne(filter = {}) { return new FirestoreQuery(this, filter, { single: true, findOne: true }); }
  static findById(id) { return new FirestoreQuery(this, {}, { single: true, byId: id }); }

  static async findByIdAndUpdate(id, updates = {}) {
    const doc = await this.findById(id);
    if (!doc) return null;
    Object.assign(doc, updates);
    await doc.save();
    return doc;
  }

  static async findByIdAndDelete(id) {
    const doc = await this.findById(id);
    if (!doc) return null;
    await this.collection().doc(id).delete();
    return doc;
  }

  static async countDocuments(filter = {}) { return (await this.find(filter)).length; }

  static async distinct(field) {
    const docs = await this.find();
    return [...new Set(docs.map((d) => d[field]).filter((v) => v !== undefined && v !== null && v !== ''))];
  }

  static async aggregate(pipeline = []) {
    let current = (await this.find()).map((d) => d.toObject());
    for (const stage of pipeline) {
      if (stage.$group) {
        const group = stage.$group;
        const keys = Object.entries(group._id || {});
        const map = new Map();
        for (const doc of current) {
          const keyObj = {};
          for (const [k, src] of keys) {
            keyObj[k] = typeof src === 'string' && src.startsWith('$') ? doc[src.slice(1)] : src;
          }
          const mapKey = JSON.stringify(keyObj);
          if (!map.has(mapKey)) map.set(mapKey, { _id: keyObj, count: 0 });
          map.get(mapKey).count += 1;
        }
        current = Array.from(map.values());
      } else if (stage.$sort) {
        for (const [k, dir] of Object.entries(stage.$sort)) {
          if (k.startsWith('_id.')) {
            const nested = k.replace('_id.', '');
            current = [...current].sort((a, b) => {
              const av = a._id?.[nested];
              const bv = b._id?.[nested];
              if (av === bv) return 0;
              return av > bv ? dir : -dir;
            });
          } else {
            current = applySort(current, { [k]: dir });
          }
        }
      }
    }
    return current;
  }

  static async ensureUnique(field, value, currentId = null) {
    if (!value) return;
    const matches = await this.find({ [field]: value });
    const conflict = matches.find((d) => d._id !== currentId);
    if (conflict) {
      const err = new Error(`${field} already exists`);
      err.code = 11000;
      throw err;
    }
  }

  static applySelect(doc, selectSpec) {
    if (!doc || !selectSpec) return doc;
    const excludes = String(selectSpec).split(/\s+/).filter((t) => t.startsWith('-')).map((t) => t.slice(1));
    if (!excludes.length) return doc;
    const clone = new this(doc.toObject());
    clone.isNew = false;
    for (const field of excludes) delete clone[field];
    clone._snapshot = clone.toObject();
    return clone;
  }

  static async populateDocuments(docs, pathName, select) {
    const ref = this.refs()?.[pathName];
    if (!ref) return docs;

    const TargetModel = ref.model();
    const ids = [...new Set(docs.map((doc) => doc[pathName]).filter(Boolean))];
    if (!ids.length) return docs;

    const loaded = await Promise.all(ids.map((id) => TargetModel.findById(id)));
    const lookup = new Map();
    for (const item of loaded) {
      if (!item) continue;
      lookup.set(item._id, select ? TargetModel.applySelect(item, select) : item);
    }

    for (const doc of docs) {
      const id = doc[pathName];
      if (!id) continue;
      doc[pathName] = lookup.get(id) || null;
    }
    return docs;
  }
}

const connectDB = async () => {
  try {
    initFirebase();
    console.log('✅ Firestore Connected');
  } catch (error) {
    console.error(`❌ Firestore Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.initFirebase = initFirebase;
module.exports.getFirestore = getFirestore;
module.exports.FirestoreModel = FirestoreModel;
module.exports.admin = admin;
