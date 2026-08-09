const mongoose = require('mongoose');

const DressRentalSettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    dressTypes: [
      {
        name: { type: String, required: true },
        chargeAmount: { type: Number, default: 0, min: 0 },
      },
    ],
    prefix: {
      type: String,
      default: 'Dress',
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
  return db.model('DressRentalSettings', DressRentalSettingsSchema);
};
