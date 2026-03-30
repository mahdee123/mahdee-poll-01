import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

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

router.get('/income', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  const { range = 'today', startDate, endDate } = req.query;
  const { from, to } = resolveRange(range, startDate, endDate);
  const match = { companyId: req.companyId };
  if (from && to) {
    match.date = { $gte: from, $lte: to };
  }

  // Get income transactions
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  const Expense = getCompanyModel(req.companyDb, 'Expense');
  
  const transactions = await Transaction.find(match);
  const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);
  const entryIncome = transactions
    .filter((t) => t.serviceType === 'Daily Entry')
    .reduce((sum, t) => sum + t.amount, 0);
  const trainingIncome = transactions
    .filter((t) => t.serviceType === 'Training')
    .reduce((sum, t) => sum + t.amount, 0);
  const membershipIncome = transactions
    .filter((t) => t.serviceType === 'Membership')
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

  // Calculate net cash
  const netCash = totalIncome - totalExpense;

  // Timeline data - aggregate by date with income and expense
  const timelineMap = {};
  
  // Add income transactions
  transactions.forEach((t) => {
    const dateKey = new Date(t.date).toISOString().split('T')[0];
    if (!timelineMap[dateKey]) {
      timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0, netCash: 0 };
    }
    timelineMap[dateKey].income += t.amount;
  });
  
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
    { name: 'Daily Entry', value: entryIncome },
    { name: 'Training', value: trainingIncome },
    { name: 'Membership', value: membershipIncome },
  ];

  return res.json({
    totalIncome,
    entryIncome,
    trainingIncome,
    membershipIncome,
    totalExpense,
    expenseByCategory,
    netCash,
    timeline,
    distribution,
  });
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
