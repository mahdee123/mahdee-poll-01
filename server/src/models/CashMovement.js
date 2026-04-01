import mongoose from 'mongoose';

const cashMovementSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL'],
      required: true,
    },
    category: {
      type: String,
      enum: [
        'Bank Deposit',
        'Bank Withdrawal',
        'Owner Addition',
        'Owner Withdrawal',
        'Petty Cash In',
        'Petty Cash Out',
        'Customer Advance',
        'Salary Payment',
        'Expense Payment',
        'Other',
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['Cash', 'Bank', 'Check', 'bKash', 'Other'],
      default: 'Bank',
    },
    reason: { type: String, required: true },
    reference: { type: String, default: '' }, // e.g., check number, transaction ID
    notes: { type: String, default: '' },
    createdBy: { type: String, default: '' }, // User email who created this
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default cashMovementSchema;
