const mongoose = require('mongoose');

const DressSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    dressNumber: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    chargeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Available', 'Rented', 'Maintenance', 'Disabled'],
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

DressSchema.index({ companyId: 1, dressNumber: 1 }, { unique: true });

module.exports = (db) => {
  return db.model('Dress', DressSchema);
};
