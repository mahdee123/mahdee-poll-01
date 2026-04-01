import mongoose from 'mongoose';

const openingBalanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    amount: { 
      type: Number, 
      required: [true, 'Opening balance amount is required'],
      default: 0,
      description: 'The one-time initial opening balance when company starts using the system'
    },
    setByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      description: 'User who set the opening balance'
    },
    setDate: {
      type: Date,
      default: Date.now,
      description: 'When the opening balance was set'
    },
    isLocked: {
      type: Boolean,
      default: true,
      description: 'Once set to true, opening balance cannot be changed - it is immutable'
    },
    note: { 
      type: String, 
      default: '',
      description: 'Optional note about the opening balance'
    },
  },
  { 
    timestamps: true,
    collection: 'opening_balances'
  }
);

// Ensure only one opening balance record per company
openingBalanceSchema.index({ companyId: 1 }, { unique: true });

export default mongoose.model('OpeningBalance', openingBalanceSchema);
