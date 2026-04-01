import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mongoUri: { type: String, required: true }, // Connection string for company's database
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    defaultMemberFee: { type: Number, default: 2000 }, // Default monthly fee for new members
    feeMigrationCompleted: { type: Boolean, default: false }, // Track if migration has been run
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
