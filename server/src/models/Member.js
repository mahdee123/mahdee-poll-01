import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    plan: { type: String, enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'Expired', 'Inactive'], default: 'Active' },
    amountPaid: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
    lastPaymentDate: { type: Date, default: null },
    advanceCredit: { type: Number, default: 0 }, // Overpayment stored as credit for future dues
    dueHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number },
        reason: { type: String }, // 'Monthly Due' or 'Payment'
        type: { type: String, enum: ['Due', 'Payment'] }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Member', memberSchema);
