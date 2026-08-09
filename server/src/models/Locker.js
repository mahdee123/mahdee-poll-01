const mongoose = require('mongoose');

const LockerSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    lockerNumber: {
      type: String,
      required: true,
      index: true, // For searching by locker number
    },
    status: {
      type: String,
      enum: ['Available', 'Occupied', 'Maintenance', 'Disabled'],
      default: 'Available',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for company + locker number (unique per company)
LockerSchema.index({ companyId: 1, lockerNumber: 1 }, { unique: true });

module.exports = (db) => {
  return db.model('Locker', LockerSchema);
};
