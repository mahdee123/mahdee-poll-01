const mongoose = require('mongoose');

const DailyExpenseSchema = new mongoose.Schema(
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
    categories: [
      {
        name: { type: String, required: true },
        subcategory: { type: String, default: '' },
        amount: { type: Number, required: true, min: 0 },
        notes: { type: String, default: '' },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank', 'bKash'],
      default: 'Cash',
    },
    recordedBy: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
  return db.model('DailyExpense', DailyExpenseSchema);
};
