import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

// Get the one-time company opening balance (if set)
router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const OpeningBalance = getCompanyModel(req.companyDb, 'OpeningBalance');
    
    const opening = await OpeningBalance.findOne({ companyId: req.companyId });
    
    if (!opening) {
      return res.json({
        hasBeenSet: false,
        message: 'No opening balance has been set yet'
      });
    }
    
    return res.json({
      hasBeenSet: true,
      amount: opening.amount,
      setDate: opening.setDate,
      note: opening.note,
      isLocked: opening.isLocked,
      setByUser: opening.setByUser
    });
  } catch (err) {
    console.error('Error fetching opening balance:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Initialize one-time opening balance (can only be set once)
router.post('/initialize', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { amount, note } = req.body;
    
    if (amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Amount is required' });
    }
    
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }
    
    const OpeningBalance = getCompanyModel(req.companyDb, 'OpeningBalance');
    
    // Check if opening balance already exists (immutable once set)
    const existing = await OpeningBalance.findOne({ companyId: req.companyId });
    if (existing) {
      return res.status(403).json({ 
        message: 'Opening balance has already been set and cannot be changed',
        currentAmount: existing.amount,
        setDate: existing.setDate
      });
    }
    
    // Create the one-time opening balance
    const newOpening = new (getCompanyModel(req.companyDb, 'OpeningBalance'))({
      companyId: req.companyId,
      amount: Number(amount),
      setByUser: req.user.id,
      note: note || '',
      isLocked: true
    });
    
    await newOpening.save();
    try {
      const { createOpeningBalanceEntry } = await import('../utils/journalEngine.js');
      await createOpeningBalanceEntry(req.companyDb, newOpening);
    } catch (je) { console.warn('[Journal] Failed to create opening balance entry:', je.message); }
    
    return res.status(201).json({
      message: 'Opening balance initialized successfully',
      amount: newOpening.amount,
      setDate: newOpening.setDate,
      isLocked: newOpening.isLocked
    });
  } catch (err) {
    console.error('Error initializing opening balance:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Get daily cash in hand for a specific date
// This calculates: one-time opening balance + cumulative income up to that date
router.get('/daily-balance', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }
    
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    
    const OpeningBalance = getCompanyModel(req.companyDb, 'OpeningBalance');
    const DailyBalance = getCompanyModel(req.companyDb, 'DailyBalance');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    
    const companyOpening = await OpeningBalance.findOne({ companyId: req.companyId });
    const initialBalance = companyOpening ? companyOpening.amount : 0;
    
    const existingDailyBalance = await DailyBalance.findOne({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    if (existingDailyBalance) {
      return res.json({
        date: queryDate.toISOString().split('T')[0],
        openingBalance: existingDailyBalance.openingBalance,
        income: existingDailyBalance.income,
        expense: 0,
        closingBalance: existingDailyBalance.closingBalance,
        source: 'snapshot'
      });
    }
    
    let dateOpeningBalance = initialBalance;
    
    if (companyOpening) {
      const previousDate = new Date(queryDate);
      previousDate.setDate(previousDate.getDate() - 1);
      
      const previousDailyBalance = await DailyBalance.findOne({
        companyId: req.companyId,
        date: { $gte: previousDate, $lt: new Date(previousDate.getTime() + 86400000) }
      });
      
      if (previousDailyBalance) {
        dateOpeningBalance = previousDailyBalance.closingBalance;
      } else {
        const firstTransaction = await Transaction.findOne(
          { companyId: req.companyId },
          {},
          { sort: { date: 1 } }
        );
        
        if (firstTransaction && new Date(firstTransaction.date) < previousDate) {
          const cumulativeStart = new Date(companyOpening.setDate || new Date(0));
          cumulativeStart.setHours(0, 0, 0, 0);
          
          const allTransactionsUpToPrevious = await Transaction.find({
            companyId: req.companyId,
            date: { $gte: cumulativeStart, $lt: previousDate }
          });
          
          const allBeveragesUpToPrevious = await BeverageSale.find({
            companyId: req.companyId,
            date: { $gte: cumulativeStart, $lt: previousDate }
          });
          
          const allExpensesUpToPrevious = await Expense.find({
            companyId: req.companyId,
            date: { $gte: cumulativeStart, $lt: previousDate }
          });
          
          const cumulativeIncome = allTransactionsUpToPrevious.reduce((sum, t) => sum + t.amount, 0) +
                                   allBeveragesUpToPrevious.reduce((sum, s) => sum + s.totalAmount, 0);
          const cumulativeExpenses = allExpensesUpToPrevious.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
          
          dateOpeningBalance = initialBalance + cumulativeIncome - cumulativeExpenses;
        }
      }
    }
    
    const todayTransactions = await Transaction.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    const todayBeverages = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    const todayIncome = todayTransactions.reduce((sum, t) => sum + t.amount, 0) +
                       todayBeverages.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // Fetch today's expenses
    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');
    const todayExpenses = await DailyExpense.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    }).lean();
    const todayExpense = todayExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    
    const closingBalance = dateOpeningBalance + todayIncome - todayExpense;
    
    return res.json({
      date: queryDate.toISOString().split('T')[0],
      openingBalance: dateOpeningBalance,
      income: todayIncome,
      expense: todayExpense,
      closingBalance: closingBalance,
      source: 'calculated'
    });
  } catch (err) {
    console.error('Error fetching daily balance:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

export default router;

