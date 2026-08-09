const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['Transaction', 'CashMovement', 'DailyExpense', 'OpeningBalance', 'Manual'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lines: [
      {
        accountCode: { type: String, required: true },
        accountName: { type: String, required: true },
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
      },
    ],
    totalDebit: {
      type: Number,
      required: true,
    },
    totalCredit: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: String,
      default: '',
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    isReversal: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ companyId: 1, date: 1 });
JournalEntrySchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });

module.exports = (db) => {
  return db.model('JournalEntry', JournalEntrySchema);
};
