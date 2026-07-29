const FirebaseModel = require('../utils/firebaseModel');

class ActivityLog extends FirebaseModel {
  constructor() {
    super('activity_logs');
  }
}

module.exports = new ActivityLog();
