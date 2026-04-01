import mongoose from 'mongoose';

const dailyBalanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { 
      type: Date, 
      required: true,
      description: 'The date of this daily balance record (day start at 00:00:00)'
    },
    openingBalance: { 
      type: Number, 
      required: true,
      description: 'Opening balance for this day (carries forward from previous day closing or initial opening balance)'
    },
    income: { 
      type: Number, 
      required: true,
      default: 0,
      description: 'Total income for this day'
    },
    expense: { 
      type: Number, 
      required: true,
      default: 0,
      description: 'Total expense for this day'
    },
    closingBalance: { 
      type: Number, 
      required: true,
      description: 'Closing balance = openingBalance + income - expense'
    },
  },
  { 
    timestamps: true,
    collection: 'daily_balances'
  }
);

// Ensure one daily balance record per company per day
dailyBalanceSchema.index({ companyId: 1, date: 1 }, { unique: true });
dailyBalanceSchema.index({ companyId: 1, date: -1 });

// Pre-save hook to validate and calculate closing balance
dailyBalanceSchema.pre('save', function(next) {
  this.closingBalance = this.openingBalance + this.income - this.expense;
  next();
});

export default mongoose.model('DailyBalance', dailyBalanceSchema);
