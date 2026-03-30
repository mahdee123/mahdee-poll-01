import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: Date, default: Date.now, required: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for date-based queries
expenseSchema.index({ date: 1 });
expenseSchema.index({ category: 1 });

export default mongoose.model('Expense', expenseSchema);
