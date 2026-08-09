import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mongoUri: { type: String, required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    defaultMemberFee: { type: Number, default: 2000 },
    feeMigrationCompleted: { type: Boolean, default: false },
    membershipSettings: {
      baseFees: {
        admissionFee: { enabled: { type: Boolean, default: true }, amount: { type: Number, default: 2500 } },
        monthlyFee: { enabled: { type: Boolean, default: true }, amount: { type: Number, default: 2000 } },
      },
      packages: [
        {
          title: String,
          duration: Number,
          amount: Number,
          monthlyFee: Number,
          color: { type: String, default: '#6366F1' },
          admissionFee: { type: Boolean, default: true },
        }
      ],
      autoInactiveMonths: { type: Number, default: 3 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
