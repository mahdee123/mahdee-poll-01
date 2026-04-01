import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';
import mongoose from 'mongoose';

const router = express.Router();

const resolveRange = (range, start, end) => {
  const now = new Date();
  if (range === 'today') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (range === 'yesterday') {
    const from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (range === 'last7days') {
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (range === 'thisMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (range === 'custom' && start && end) {
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(end);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  // Default to today if no valid range
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

// Helper function to get opening balance for today (yesterday's closing)
const getOpeningBalance = async (req, companyDb) => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const OpeningBalance = getCompanyModel(companyDb, 'OpeningBalance');
    const Expense = getCompanyModel(companyDb, 'Expense');
    const Transaction = getCompanyModel(companyDb, 'Transaction');
    const BeverageSale = getCompanyModel(companyDb, 'BeverageSale');
    
    // Get the one-time company opening balance
    const companyOpening = await OpeningBalance.findOne({ companyId: req.companyId });
    const initialBalance = companyOpening ? companyOpening.amount : 0;
    
    // If no opening balance set yet, return 0
    if (!companyOpening) {
      return 0;
    }
    
    // Get all transactions, beverages, and expenses up to but not including today
    const allTransactionsUpToYesterday = await Transaction.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const allBeveragesUpToYesterday = await BeverageSale.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const allExpensesUpToYesterday = await Expense.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const cumulativeIncome = allTransactionsUpToYesterday.reduce((sum, t) => sum + t.amount, 0) +
                             allBeveragesUpToYesterday.reduce((sum, s) => sum + s.totalAmount, 0);
    const cumulativeExpense = allExpensesUpToYesterday.reduce((sum, e) => sum + e.amount, 0);
    
    // Today's opening = initial opening balance + cumulative income - cumulative expense
    const todayOpeningBalance = initialBalance + cumulativeIncome - cumulativeExpense;
    
    return todayOpeningBalance;
  } catch (err) {
    console.error('Error calculating opening balance:', err);
    return 0;
  }
};

router.get('/income', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  const { range = 'today', startDate, endDate, sections } = req.query;
  const { from, to } = resolveRange(range, startDate, endDate);
  const match = { companyId: req.companyId };
  if (from && to) {
    match.date = { $gte: from, $lte: to };
  }

  // Parse sections filter - defaults to all if not provided
  const selectedSections = sections 
    ? sections.split(',').map(s => s.trim())
    : ['daily-entry', 'training', 'membership', 'bills', 'beverages'];

  // Get income transactions
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  const Expense = getCompanyModel(req.companyDb, 'Expense');
  const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');
  
  // Filter transactions by selected sections
  const serviceTypeMap = {
    'daily-entry': 'Daily Entry',
    'training': 'Training',
    'membership': 'Membership',
    'bills': 'Bill'
  };
  
  const selectedServiceTypes = selectedSections
    .filter(s => s !== 'beverages')
    .map(s => serviceTypeMap[s])
    .filter(Boolean);

  const transactions = await Transaction.find(match);
  const filteredTransactions = selectedServiceTypes.length > 0
    ? transactions.filter(t => selectedServiceTypes.includes(t.serviceType))
    : [];

  // Get beverages income if selected
  let beveragesIncome = 0;
  let beverageSales = [];
  if (selectedSections.includes('beverages')) {
    beverageSales = await BeverageSale.find(match);
    beveragesIncome = beverageSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  }

  const totalIncome = filteredTransactions.reduce((sum, t) => sum + t.amount, 0) + beveragesIncome;
  const entryIncome = filteredTransactions
    .filter((t) => t.serviceType === 'Daily Entry')
    .reduce((sum, t) => sum + t.amount, 0);
  const trainingIncome = filteredTransactions
    .filter((t) => t.serviceType === 'Training')
    .reduce((sum, t) => sum + t.amount, 0);
  const membershipIncome = filteredTransactions
    .filter((t) => t.serviceType === 'Membership')
    .reduce((sum, t) => sum + t.amount, 0);
  const billIncome = filteredTransactions
    .filter((t) => t.serviceType === 'Bill')
    .reduce((sum, t) => sum + t.amount, 0);

  // Get expenses
  const expenses = await Expense.find(match);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Expense breakdown by category
  const expenseByCategory = {};
  ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].forEach(cat => {
    expenseByCategory[cat] = expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  // Calculate net cash and closing balance (which is based only on actual transactions, no opening balance offset)
  const netCash = totalIncome - totalExpense;

  // Timeline data - aggregate by date with income and expense
  const timelineMap = {};
  
  // Add filtered income transactions
  filteredTransactions.forEach((t) => {
    const dateKey = new Date(t.date).toISOString().split('T')[0];
    if (!timelineMap[dateKey]) {
      timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0, netCash: 0 };
    }
    timelineMap[dateKey].income += t.amount;
  });

  // Add beverages income to timeline if selected
  if (selectedSections.includes('beverages')) {
    beverageSales.forEach((sale) => {
      const dateKey = new Date(sale.date).toISOString().split('T')[0];
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0, netCash: 0 };
      }
      timelineMap[dateKey].income += sale.totalAmount;
    });
  }
  
  // Add expenses
  expenses.forEach((e) => {
    const dateKey = new Date(e.date).toISOString().split('T')[0];
    if (!timelineMap[dateKey]) {
      timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0, netCash: 0 };
    }
    timelineMap[dateKey].expense += e.amount;
  });
  
  // Calculate net cash for each day and sort by date
  const timeline = Object.values(timelineMap)
    .map(item => ({
      date: item.date,
      income: item.income,
      expense: item.expense,
      netCash: item.income - item.expense,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const distribution = [
    ...(selectedSections.includes('daily-entry') ? [{ name: 'Daily Entry', value: entryIncome }] : []),
    ...(selectedSections.includes('training') ? [{ name: 'Training', value: trainingIncome }] : []),
    ...(selectedSections.includes('membership') ? [{ name: 'Membership', value: membershipIncome }] : []),
    ...(selectedSections.includes('bills') ? [{ name: 'Bills', value: billIncome }] : []),
    ...(selectedSections.includes('beverages') ? [{ name: 'Beverages', value: beveragesIncome }] : []),
  ];

  // Add daily balance info when range is 'today'
  let dailyBalance = null;
  if (range === 'today') {
    const openingBalance = await getOpeningBalance(req, req.companyDb);
    const closingBalance = openingBalance + totalIncome - totalExpense;
    dailyBalance = {
      openingBalance,
      income: totalIncome,
      expense: totalExpense,
      closingBalance,
    };
  }

  const response = {
    totalIncome,
    entryIncome,
    trainingIncome,
    membershipIncome,
    billIncome,
    beveragesIncome,
    totalExpense,
    expenseByCategory,
    netCash,
    timeline,
    distribution,
  };

  if (dailyBalance) {
    response.dailyBalance = dailyBalance;
  }

  return res.json(response);
});

// Expense Report - breakdown by category and payment method
router.get('/expenses', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { range = 'today', startDate, endDate } = req.query;
    const { from, to } = resolveRange(range, startDate, endDate);
    const match = { companyId: req.companyId };
    if (from && to) {
      match.date = { $gte: from, $lte: to };
    }

    // Get expenses
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expenses = await Expense.find(match);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryBreakdown = [];
    ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].forEach((cat) => {
      const categoryAmount = expenses
        .filter((e) => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      if (categoryAmount > 0) {
        categoryBreakdown.push({
          category: cat,
          amount: categoryAmount,
          percentage: totalExpense > 0 ? ((categoryAmount / totalExpense) * 100).toFixed(2) : 0,
        });
      }
    });

    // Payment method breakdown
    const paymentMethods = {};
    ['Cash', 'Bank', 'bKash'].forEach((method) => {
      paymentMethods[method] = expenses
        .filter((e) => e.paymentMethod === method)
        .reduce((sum, e) => sum + e.amount, 0);
    });

    return res.json({
      totalExpense,
      categoryBreakdown,
      paymentMethods,
    });
  } catch (err) {
    console.error('Error fetching expense report:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Financial Summary - Total Income, Expense, and Net Profit
router.get('/financial-summary', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { range = 'today', startDate, endDate } = req.query;
    const { from, to } = resolveRange(range, startDate, endDate);
    const match = { companyId: req.companyId };
    if (from && to) {
      match.date = { $gte: from, $lte: to };
    }

    // Income
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    
    const transactions = await Transaction.find(match);
    const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Expenses
    const expenses = await Expense.find(match);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Net Profit
    const netProfit = totalIncome - totalExpense;

    return res.json({
      totalIncome,
      totalExpense,
      netProfit,
    });
  } catch (err) {
    console.error('Error fetching financial summary:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

export default router;
