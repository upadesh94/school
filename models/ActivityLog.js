const { FirestoreModel } = require('../config/db');

class ActivityLog extends FirestoreModel {
  static collectionName() {
    return 'activity_logs';
  }

  static defaults() {
    return {
      action: '',
      performedBy: '',
      performedByRole: '',
      performedById: null,
      target: '',
      targetId: null,
      details: '',
      ipAddress: '',
      createdAt: null,
      updatedAt: null,
    };
  }
}

module.exports = ActivityLog;
