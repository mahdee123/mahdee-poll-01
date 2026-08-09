import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';
import { getAccountLedger, getTrialBalance } from '../utils/journalEngine.js';

const router = express.Router();

// List all accounts with current period balances
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const Account = getCompanyModel(req.companyDb, 'Account');
    const AccountBalance = getCompanyModel(req.companyDb, 'AccountBalance');

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let accounts = await Account.find({ companyId: req.companyId }).lean();

    // Auto-seed accounts if none exist (for existing companies)
    if (accounts.length === 0) {
      const defaultAccounts = [
        { code: '1000', name: 'Cash in Hand', type: 'Asset' },
        { code: '1010', name: 'Bank Account', type: 'Asset' },
        { code: '1020', name: 'bKash Account', type: 'Asset' },
        { code: '1030', name: 'Petty Cash', type: 'Asset' },
        { code: '1040', name: 'Accounts Receivable', type: 'Asset' },
        { code: '2000', name: 'Accounts Payable', type: 'Liability' },
        { code: '2010', name: 'Customer Advances', type: 'Liability' },
        { code: '3000', name: "Owner's Capital", type: 'Equity' },
        { code: '3010', name: 'Retained Earnings', type: 'Equity' },
        { code: '4000', name: 'Daily Entry Income', type: 'Revenue' },
        { code: '4010', name: 'Training Income', type: 'Revenue' },
        { code: '4020', name: 'Membership Income', type: 'Revenue' },
        { code: '4030', name: 'Beverage Income', type: 'Revenue' },
        { code: '4040', name: 'Hourly Session Income', type: 'Revenue' },
        { code: '4050', name: 'Locker Income', type: 'Revenue' },
        { code: '4060', name: 'Dress Rental Income', type: 'Revenue' },
        { code: '5000', name: 'Salary Expense', type: 'Expense' },
        { code: '5010', name: 'Maintenance Expense', type: 'Expense' },
        { code: '5020', name: 'Utility Expense', type: 'Expense' },
        { code: '5030', name: 'Supplies Expense', type: 'Expense' },
        { code: '5040', name: 'Beverage Cost (COGS)', type: 'Expense' },
        { code: '5050', name: 'Other Expense', type: 'Expense' },
      ].map(a => ({ ...a, companyId: req.companyId, isActive: true, description: '' }));
      await Account.insertMany(defaultAccounts);
      accounts = await Account.find({ companyId: req.companyId }).lean();
    }
    const balances = await AccountBalance.find({ companyId: req.companyId, period }).lean();

    const balanceMap = {};
    for (const b of balances) {
      balanceMap[b.accountCode] = b;
    }

    const result = accounts.map(acc => ({
      ...acc,
      currentPeriod: balanceMap[acc.code] || {
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
      },
    }));

    return res.json({ accounts: result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Trial balance for a given period
router.get('/trial-balance', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { period } = req.query;

    let targetPeriod = period;
    if (!targetPeriod) {
      const now = new Date();
      targetPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const trialBalance = await getTrialBalance(req.companyDb, req.companyId, targetPeriod);
    return res.json(trialBalance);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Summary totals by account type
router.get('/summary', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const AccountBalance = getCompanyModel(req.companyDb, 'AccountBalance');

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const balances = await AccountBalance.find({ companyId: req.companyId, period }).lean();

    const summary = {
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalRevenue: 0,
      totalExpenses: 0,
    };

    for (const b of balances) {
      switch (b.accountType) {
        case 'Asset':
          summary.totalAssets += b.balance;
          break;
        case 'Liability':
          summary.totalLiabilities += b.balance;
          break;
        case 'Equity':
          summary.totalEquity += b.balance;
          break;
        case 'Revenue':
          summary.totalRevenue += b.balance;
          break;
        case 'Expense':
          summary.totalExpenses += b.balance;
          break;
      }
    }

    return res.json({
      ...summary,
      netProfit: summary.totalRevenue - summary.totalExpenses,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get single account details
router.get('/:code', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const Account = getCompanyModel(req.companyDb, 'Account');
    const account = await Account.findOne({
      companyId: req.companyId,
      code: req.params.code,
    }).lean();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({ account });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get account ledger
router.get('/:code/ledger', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ledger = await getAccountLedger(
      req.companyDb,
      req.companyId,
      req.params.code,
      startDate,
      endDate
    );
    return res.json({ ledger });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new account (admin only)
router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { code, name, type, parentCode, description } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({ error: 'Code, name, and type are required' });
    }

    const Account = getCompanyModel(req.companyDb, 'Account');

    const existing = await Account.findOne({ companyId: req.companyId, code });
    if (existing) {
      return res.status(400).json({ error: 'Account code already exists' });
    }

    const account = new Account({
      companyId: req.companyId,
      code,
      name,
      type,
      parentCode: parentCode || null,
      description: description || '',
    });

    await account.save();
    return res.status(201).json({ account });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update account (admin only)
router.put('/:code', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { name, type, parentCode, description, isActive } = req.body;
    const Account = getCompanyModel(req.companyDb, 'Account');

    const account = await Account.findOneAndUpdate(
      { companyId: req.companyId, code: req.params.code },
      {
        $set: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(parentCode !== undefined && { parentCode }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    return res.json({ account });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
