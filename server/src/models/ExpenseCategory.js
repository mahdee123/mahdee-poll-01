const mongoose = require('mongoose');

const ExpenseCategorySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: '#6366F1',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    subcategories: [
      {
        name: { type: String, required: true },
        sortOrder: { type: Number, default: 0 },
      },
    ],
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

ExpenseCategorySchema.index({ companyId: 1, name: 1 }, { unique: true });
ExpenseCategorySchema.index({ companyId: 1, isActive: 1, sortOrder: 1 });

module.exports = (db) => {
  return db.model('ExpenseCategory', ExpenseCategorySchema);
};
