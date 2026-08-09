import { getCompanyModel } from './modelRegistry.js';

// ============================================
// ACCOUNT MAPPING DEFINITIONS
// ============================================

const INCOME_ACCOUNT_MAP = {
  'Daily Entry': { debit: '1000', credit: '4000' },
  'Bill': { debit: '1000', credit: '4000' },
  'Training': { debit: '1000', credit: '4010' },
  'Membership': { debit: '1000', credit: '4020' },
  'Beverage': { debit: '1000', credit: '4030' },
  'Hourly Session': { debit: '1000', credit: '4040' },
  'Locker': { debit: '1000', credit: '4050' },
  'Dress Rental': { debit: '1000', credit: '4060' },
};

const PAYMENT_METHOD_TO_ASSET = {
  'Cash': '1000',
  'Bank': '1010',
  'bKash': '1020',
};

const EXPENSE_CATEGORY_MAP = {
  'Salary': '5000',
  'Maintenance': '5010',
  'Utility': '5020',
  'Supplies': '5030',
  'Beverage Cost': '5040',
  'Other': '5050',
};

const CASH_MOVEMENT_MAP = {
  'DEPOSIT_Bank Deposit': { debit: '1010', credit: '1000' },
  'WITHDRAWAL_Bank Withdrawal': { debit: '1000', credit: '1010' },
  'DEPOSIT_Owner Addition': { debit: '1000', credit: '3000' },
  'WITHDRAWAL_Owner Withdrawal': { debit: '3000', credit: '1000' },
  'DEPOSIT_Petty Cash In': { debit: '1030', credit: '1000' },
  'WITHDRAWAL_Petty Cash Out': { debit: '1000', credit: '1030' },
  'WITHDRAWAL_Salary Payment': { debit: '5000', credit: '1000' },
  // Note: 'Other' deposits/withdrawals are intentionally NOT mapped here.
  // They previously debited and credited the same Cash account ('1000'),
  // which is a self-canceling entry that never actually moved the Cash
  // balance despite real money changing hands. The generic fallback below
  // (Cash <-> Owner's Capital / Other Expense) handles them correctly.
};

// ============================================
// HELPER: Get account name from code
// ============================================

const ACCOUNT_NAMES = {
  '1000': 'Cash in Hand',
  '1010': 'Bank Account',
  '1020': 'bKash Account',
  '1030': 'Petty Cash',
  '1040': 'Accounts Receivable',
  '2000': 'Accounts Payable',
  '2010': 'Customer Advances',
  '3000': "Owner's Capital",
  '3010': 'Retained Earnings',
  '4000': 'Daily Entry Income',
  '4010': 'Training Income',
  '4020': 'Membership Income',
  '4030': 'Beverage Income',
  '4040': 'Hourly Session Income',
  '4050': 'Locker Income',
  '4060': 'Dress Rental Income',
  '5000': 'Salary Expense',
  '5010': 'Maintenance Expense',
  '5020': 'Utility Expense',
  '5030': 'Supplies Expense',
  '5040': 'Beverage Cost (COGS)',
  '5050': 'Other Expense',
};

const getAccountName = (code) => ACCOUNT_NAMES[code] || `Account ${code}`;

const getPeriod = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// ============================================
// CORE: Create Journal Entry
// ============================================

export const createJournalEntry = async (companyDb, companyId, {
  date,
  description,
  referenceType,
  referenceId = null,
  lines,
  createdBy = '',
  isReversal = false,
}) => {
  const JournalEntry = getCompanyModel(companyDb, 'JournalEntry');

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry does not balance: debit ${totalDebit} != credit ${totalCredit}`);
  }

  const entry = new JournalEntry({
    companyId,
    date: new Date(date),
    description,
    referenceType,
    referenceId,
    lines: lines.map(l => ({
      accountCode: l.accountCode,
      accountName: getAccountName(l.accountCode),
      debit: l.debit || 0,
      credit: l.credit || 0,
    })),
    totalDebit,
    totalCredit,
    createdBy,
    isReversal,
  });

  await entry.save();

  // Update account balances
  await updateAccountBalances(companyDb, companyId, entry);

  return entry;
};

// ============================================
// UPDATE ACCOUNT BALANCES
// ============================================

export const updateAccountBalances = async (companyDb, companyId, entry) => {
  const AccountBalance = getCompanyModel(companyDb, 'AccountBalance');
  const period = getPeriod(entry.date);

  for (const line of entry.lines) {
    if (line.debit === 0 && line.credit === 0) continue;

    const accountType = getAccountTypeFromCode(line.accountCode);
    let balance = 0;

    if (accountType === 'Asset' || accountType === 'Expense') {
      balance = line.debit - line.credit;
    } else {
      balance = line.credit - line.debit;
    }

    await AccountBalance.findOneAndUpdate(
      { companyId, accountCode: line.accountCode, period },
      {
        $inc: {
          debitTotal: line.debit,
          creditTotal: line.credit,
          balance: balance,
        },
        $setOnInsert: {
          accountName: line.accountName,
          accountType,
        },
      },
      { upsert: true, new: true }
    );
  }
};

const getAccountTypeFromCode = (code) => {
  const prefix = parseInt(code.substring(0, 1));
  if (prefix === 1) return 'Asset';
  if (prefix === 2) return 'Liability';
  if (prefix === 3) return 'Equity';
  if (prefix === 4) return 'Revenue';
  if (prefix === 5) return 'Expense';
  return 'Asset';
};

// ============================================
// INCOME ENTRY (from Transaction)
// ============================================

export const createIncomeEntry = async (companyDb, transaction) => {
  const mapping = INCOME_ACCOUNT_MAP[transaction.serviceType];
  if (!mapping) {
    console.warn(`[JournalEngine] No account mapping for serviceType: ${transaction.serviceType}`);
    return null;
  }

  const assetCode = PAYMENT_METHOD_TO_ASSET[transaction.paymentMethod] || '1000';
  const debitCode = assetCode;
  const creditCode = mapping.credit;
  const amount = transaction.amount || 0;

  if (amount <= 0) return null;

  return createJournalEntry(companyDb, transaction.companyId, {
    date: transaction.date || transaction.createdAt || new Date(),
    description: `${transaction.serviceType} income from ${transaction.name || 'customer'} (${transaction.paymentMethod || 'Cash'})`,
    referenceType: 'Transaction',
    referenceId: transaction._id,
    lines: [
      { accountCode: debitCode, debit: amount },
      { accountCode: creditCode, credit: amount },
    ],
    createdBy: transaction.createdBy || 'System',
  });
};

// ============================================
// EXPENSE ENTRY (from DailyExpense)
// ============================================

export const createExpenseEntry = async (companyDb, dailyExpense) => {
  const assetCode = PAYMENT_METHOD_TO_ASSET[dailyExpense.paymentMethod] || '1000';
  const lines = [];

  for (const cat of (dailyExpense.categories || [])) {
    if (!cat.amount || cat.amount <= 0) continue;
    const expenseCode = EXPENSE_CATEGORY_MAP[cat.name] || '5050';
    lines.push({ accountCode: expenseCode, debit: cat.amount });
  }

  if (lines.length === 0) return null;

  const totalExpense = lines.reduce((sum, l) => sum + l.debit, 0);
  lines.push({ accountCode: assetCode, credit: totalExpense });

  const entry = await createJournalEntry(companyDb, dailyExpense.companyId, {
    date: dailyExpense.date,
    description: `Daily expenses: ${dailyExpense.categories.map(c => `${c.name} ৳${c.amount}`).join(', ')}`,
    referenceType: 'DailyExpense',
    referenceId: dailyExpense._id,
    lines,
    createdBy: dailyExpense.recordedBy || 'System',
  });

  // Update DailyExpense with journalEntryId
  const DailyExpense = getCompanyModel(companyDb, 'DailyExpense');
  await DailyExpense.findByIdAndUpdate(dailyExpense._id, { journalEntryId: entry._id });

  return entry;
};

// ============================================
// CASH MOVEMENT ENTRY
// ============================================

export const createCashMovementEntry = async (companyDb, movement) => {
  const key = `${movement.type}_${movement.category}`;
  const mapping = CASH_MOVEMENT_MAP[key];

  if (!mapping) {
    // Generic fallback
    if (movement.type === 'DEPOSIT') {
      return createJournalEntry(companyDb, movement.companyId, {
        date: movement.date,
        description: `${movement.category}: ${movement.reason}`,
        referenceType: 'CashMovement',
        referenceId: movement._id,
        lines: [
          { accountCode: '1000', debit: movement.amount },
          { accountCode: '3000', credit: movement.amount },
        ],
        createdBy: movement.createdBy || 'System',
      });
    } else {
      return createJournalEntry(companyDb, movement.companyId, {
        date: movement.date,
        description: `${movement.category}: ${movement.reason}`,
        referenceType: 'CashMovement',
        referenceId: movement._id,
        lines: [
          { accountCode: '5050', debit: movement.amount },
          { accountCode: '1000', credit: movement.amount },
        ],
        createdBy: movement.createdBy || 'System',
      });
    }
  }

  return createJournalEntry(companyDb, movement.companyId, {
    date: movement.date,
    description: `${movement.category}: ${movement.reason}`,
    referenceType: 'CashMovement',
    referenceId: movement._id,
    lines: [
      { accountCode: mapping.debit, debit: movement.amount },
      { accountCode: mapping.credit, credit: movement.amount },
    ],
    createdBy: movement.createdBy || 'System',
  });
};

// ============================================
// OPENING BALANCE ENTRY
// ============================================

export const createOpeningBalanceEntry = async (companyDb, opening) => {
  if (!opening.amount || opening.amount <= 0) return null;

  return createJournalEntry(companyDb, opening.companyId, {
    date: opening.setDate || new Date(),
    description: `Opening balance: ৳${opening.amount}`,
    referenceType: 'OpeningBalance',
    referenceId: opening._id,
    lines: [
      { accountCode: '1000', debit: opening.amount },
      { accountCode: '3000', credit: opening.amount },
    ],
    createdBy: 'System',
  });
};

// ============================================
// REVERSE ENTRY
// ============================================

export const reverseJournalEntry = async (companyDb, companyId, entryId, reason, reversedBy = 'System') => {
  const JournalEntry = getCompanyModel(companyDb, 'JournalEntry');
  const original = await JournalEntry.findOne({ _id: entryId, companyId });

  if (!original) throw new Error('Journal entry not found');
  if (original.isReversal) throw new Error('Cannot reverse a reversal entry');

  // Create reversal with swapped debit/credit
  const reversalLines = original.lines.map(l => ({
    accountCode: l.accountCode,
    debit: l.credit,
    credit: l.debit,
  }));

  const reversal = await createJournalEntry(companyDb, companyId, {
    date: new Date(),
    description: `Reversal of: ${original.description} — ${reason}`,
    referenceType: original.referenceType,
    referenceId: original.referenceId,
    lines: reversalLines,
    createdBy: reversedBy,
    isReversal: true,
  });

  // Mark original as reversed
  original.reversedBy = reversal._id;
  await original.save();

  return reversal;
};

// ============================================
// GET ACCOUNT LEDGER
// ============================================

export const getAccountLedger = async (companyDb, companyId, accountCode, startDate, endDate) => {
  const JournalEntry = getCompanyModel(companyDb, 'JournalEntry');

  const match = {
    companyId,
    'lines.accountCode': accountCode,
  };

  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }

  const entries = await JournalEntry.find(match).sort({ date: 1 }).lean();

  const ledger = [];
  let runningBalance = 0;

  for (const entry of entries) {
    const line = entry.lines.find(l => l.accountCode === accountCode);
    if (!line) continue;

    const accountType = getAccountTypeFromCode(accountCode);
    let balanceChange = 0;
    if (accountType === 'Asset' || accountType === 'Expense') {
      balanceChange = line.debit - line.credit;
    } else {
      balanceChange = line.credit - line.debit;
    }

    runningBalance += balanceChange;

    ledger.push({
      date: entry.date,
      description: entry.description,
      referenceType: entry.referenceType,
      debit: line.debit,
      credit: line.credit,
      balance: runningBalance,
      entryId: entry._id,
    });
  }

  return ledger;
};

// ============================================
// GET TRIAL BALANCE
// ============================================

export const getTrialBalance = async (companyDb, companyId, period) => {
  const AccountBalance = getCompanyModel(companyDb, 'AccountBalance');

  const match = { companyId };
  if (period) match.period = period;

  const balances = await AccountBalance.find(match).lean();

  const accounts = balances.map(b => ({
    code: b.accountCode,
    name: b.accountName,
    type: b.accountType,
    debit: b.debitTotal,
    credit: b.creditTotal,
    balance: b.balance,
  }));

  const totalDebit = accounts.reduce((sum, a) => sum + a.debit, 0);
  const totalCredit = accounts.reduce((sum, a) => sum + a.credit, 0);

  return { accounts, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
};
