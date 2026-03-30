import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Training', 'Membership'], required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    totalClasses: { type: Number },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Package', packageSchema);
