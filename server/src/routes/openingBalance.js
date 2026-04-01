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
// This calculates: one-time opening balance + cumulative income - cumulative expense up to that date
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
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
    
    // Get the one-time company opening balance
    const companyOpening = await OpeningBalance.findOne({ companyId: req.companyId });
    const initialBalance = companyOpening ? companyOpening.amount : 0;
    
    // Check if daily balance snapshot already exists for this date
    const existingDailyBalance = await DailyBalance.findOne({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    if (existingDailyBalance) {
      return res.json({
        date: queryDate.toISOString().split('T')[0],
        openingBalance: existingDailyBalance.openingBalance,
        income: existingDailyBalance.income,
        expense: existingDailyBalance.expense,
        closingBalance: existingDailyBalance.closingBalance,
        source: 'snapshot'
      });
    }
    
    // Get the opening balance for this specific date
    // For the first day, it's the initial opening balance
    // For subsequent days, it's the previous day's closing balance
    
    let dateOpeningBalance = initialBalance;
    
    // If not the first day, get previous day's closing
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
        // Calculate all historical balances up to previous day
        const firstTransaction = await Transaction.findOne(
          { companyId: req.companyId },
          {},
          { sort: { date: 1 } }
        );
        
        if (firstTransaction && new Date(firstTransaction.date) < previousDate) {
          // Calculate cumulative balance up to previous date
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
          const cumulativeExpense = allExpensesUpToPrevious.reduce((sum, e) => sum + e.amount, 0);
          
          dateOpeningBalance = initialBalance + cumulativeIncome - cumulativeExpense;
        }
      }
    }
    
    // Get today's income
    const todayTransactions = await Transaction.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    const todayBeverages = await BeverageSale.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    const todayExpenses = await Expense.find({
      companyId: req.companyId,
      date: { $gte: queryDate, $lt: new Date(queryDate.getTime() + 86400000) }
    });
    
    const todayIncome = todayTransactions.reduce((sum, t) => sum + t.amount, 0) +
                       todayBeverages.reduce((sum, s) => sum + s.totalAmount, 0);
    const todayExpense = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
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

