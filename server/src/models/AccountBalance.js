const mongoose = require('mongoose');

const AccountBalanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    accountCode: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      required: true,
    },
    period: {
      type: String,
      required: true,
    },
    debitTotal: {
      type: Number,
      default: 0,
    },
    creditTotal: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

AccountBalanceSchema.index({ companyId: 1, accountCode: 1, period: 1 }, { unique: true });
AccountBalanceSchema.index({ companyId: 1, period: 1 });

module.exports = (db) => {
  return db.model('AccountBalance', AccountBalanceSchema);
};
