const mongoose = require('mongoose');

const LockerSettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalLockers: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockerPrefix: {
      type: String,
      default: 'Locker',
    },
    pricingMode: {
      type: String,
      enum: ['Free', 'PaidPerUse', 'Fixed'],
      default: 'Free',
    },
    chargeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    autoNumbering: {
      type: Boolean,
      default: true,
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

module.exports = (db) => {
  return db.model('LockerSettings', LockerSettingsSchema);
};
