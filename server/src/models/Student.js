import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    ageGroup: { type: String, enum: ['4-8', '9+'], required: true },
    batchType: { type: String, enum: ['Regular', 'Weekend'], required: true },
    timeSlot: { type: String, enum: ['Morning', 'Evening'], required: true },
    classSlot: { type: Number, enum: [1, 2, 3, 4], required: true },
    totalClasses: { type: Number, required: true },
    remainingClasses: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    durationDays: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    makeupUsed: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    amountPaid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    dueHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number },
        reason: { type: String },
        type: { type: String, enum: ['Due', 'Payment'] }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Student', studentSchema);
