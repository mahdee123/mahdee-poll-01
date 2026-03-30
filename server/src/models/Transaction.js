import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    name: { type: String },
    phone: { type: String },
    serviceType: { type: String, enum: ['Daily Entry', 'Training', 'Membership', 'Bill'], required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], required: true },
    date: { type: Date, default: Date.now },
    timeSlot: { type: String },
    receiptId: { type: String, unique: true, index: true },
    // Receipt context fields
    price: { type: Number }, // Original price before discount
    discount: { type: Number, default: 0 }, // Discount amount
    package: { type: String }, // For Training: e.g., "12 Classes", "16 Classes"
    batch: { type: String }, // For Training: e.g., "Morning Batch", "Evening Batch"
    duration: { type: Number }, // Duration in days
    plan: { type: String }, // For Membership: e.g., "Monthly", "Quarterly"
    startDate: { type: Date }, // Start date for membership
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', nullable: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', nullable: true },
    transactionType: { type: String, enum: ['Purchase', 'MonthlyPayment', 'DuePayment'], default: 'Purchase' },
    amountPaid: { type: Number },
    dueAmount: { type: Number },
    // Bill-specific fields
    amountPerPerson: { type: Number }, // e.g., 300, 400
    numberOfPersons: { type: Number, default: 1 } // Number of persons for group billing
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
