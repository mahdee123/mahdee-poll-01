const mongoose = require('mongoose');

const LockerAssignmentSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    lockerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'Locker',
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    memberType: {
      type: String,
      enum: ['Member', 'Student'],
      required: true,
    },
    memberName: {
      type: String,
      required: true,
    },
    memberPhone: {
      type: String,
      default: '',
    },
    assignedTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    returnedTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Returned'],
      default: 'Active',
      index: true,
    },
    chargeType: {
      type: String,
      enum: ['None', 'SeparateTransaction', 'AttachedToExistingBill'],
      default: 'None',
    },
    chargeAmount: {
      type: Number,
      default: 0,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'Transaction',
    },
    existingBillTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'Transaction',
    },
    billPayerTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
      ref: 'Transaction',
    },
    assignedByAdmin: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
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

// Indexes for quick lookups
LockerAssignmentSchema.index({ companyId: 1, lockerId: 1, status: 1 });
LockerAssignmentSchema.index({ companyId: 1, memberId: 1 });
LockerAssignmentSchema.index({ companyId: 1, status: 1 });
LockerAssignmentSchema.index({ companyId: 1, billPayerTransactionId: 1, status: 1 });

module.exports = (db) => {
  return db.model('LockerAssignment', LockerAssignmentSchema);
};
