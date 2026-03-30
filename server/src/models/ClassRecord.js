import mongoose from 'mongoose';

const classRecordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Attended', 'Missed', 'Makeup'], required: true },
  },
  { timestamps: true }
);

export default mongoose.model('ClassRecord', classRecordSchema);
