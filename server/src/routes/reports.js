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
  try {
    const { range = 'today', startDate, endDate, sections, categories, paymentMethod } = req.query;
    const { from, to } = resolveRange(range, startDate, endDate);
    const match = { companyId: req.companyId };
    if (from && to) {
      match.date = { $gte: from, $lte: to };
    }

    const selectedSections = sections
      ? sections.split(',').map((section) => section.trim())
      : ['daily-entry', 'training', 'membership', 'bills', 'beverages', 'hourly-session'];

    const selectedCategories = categories
      ? categories.split(',').map((category) => category.trim())
      : ['Bill', 'Training', 'Membership', 'Beverage', 'Hourly Session'];

    const selectedPaymentMethod = paymentMethod && paymentMethod !== 'all' ? paymentMethod : null;

    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const BeverageSale = getCompanyModel(req.companyDb, 'BeverageSale');

    const serviceTypeMap = {
      'daily-entry': 'Daily Entry',
      training: 'Training',
      membership: 'Membership',
      bills: 'Bill',
      'hourly-session': 'Hourly Session',
    };

    const selectedServiceTypes = selectedSections
      .filter((section) => section !== 'beverages')
      .map((section) => serviceTypeMap[section])
      .filter(Boolean);

    const transactions = await Transaction.find(match);
    const filteredTransactions = selectedServiceTypes.length > 0
      ? transactions.filter((transaction) => selectedServiceTypes.includes(transaction.serviceType))
      : [];

    let beverageSales = [];
    let beveragesIncome = 0;
    if (selectedSections.includes('beverages')) {
      beverageSales = await BeverageSale.find(match);
      beveragesIncome = beverageSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    }

    const totalIncome = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0) + beveragesIncome;
    const entryIncome = filteredTransactions.filter((t) => t.serviceType === 'Daily Entry').reduce((sum, t) => sum + t.amount, 0);
    const trainingIncome = filteredTransactions.filter((t) => t.serviceType === 'Training').reduce((sum, t) => sum + t.amount, 0);
    const membershipIncome = filteredTransactions.filter((t) => t.serviceType === 'Membership').reduce((sum, t) => sum + t.amount, 0);
    const billIncome = filteredTransactions.filter((t) => t.serviceType === 'Bill').reduce((sum, t) => sum + t.amount, 0);
    const hourlySessionIncome = filteredTransactions.filter((t) => t.serviceType === 'Hourly Session').reduce((sum, t) => sum + t.amount, 0);

    const expenses = await Expense.find(match);
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const expenseByCategory = {};
    ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].forEach((category) => {
      expenseByCategory[category] = expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);
    });

    const netCash = totalIncome - totalExpense;

    const timelineMap = {};
    filteredTransactions.forEach((transaction) => {
      const dateKey = new Date(transaction.date).toISOString().split('T')[0];
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0 };
      }
      timelineMap[dateKey].income += transaction.amount;
    });

    if (selectedSections.includes('beverages')) {
      beverageSales.forEach((sale) => {
        const dateKey = new Date(sale.date).toISOString().split('T')[0];
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0 };
        }
        timelineMap[dateKey].income += sale.totalAmount;
      });
    }

    expenses.forEach((expense) => {
      const dateKey = new Date(expense.date).toISOString().split('T')[0];
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, income: 0, expense: 0 };
      }
      timelineMap[dateKey].expense += expense.amount;
    });

    const timeline = Object.values(timelineMap)
      .map((item) => ({
        date: item.date,
        income: item.income,
        expense: item.expense,
        netCash: item.income - item.expense,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const dailyBreakdownMap = {};
    filteredTransactions.forEach((transaction) => {
      const dateKey = new Date(transaction.date).toISOString().split('T')[0];

      let categoryName = null;
      if (transaction.serviceType === 'Bill' && selectedCategories.includes('Bill')) categoryName = 'Bill';
      else if (transaction.serviceType === 'Training' && selectedCategories.includes('Training')) categoryName = 'Training';
      else if (transaction.serviceType === 'Membership' && selectedCategories.includes('Membership')) categoryName = 'Membership';
      else if (transaction.serviceType === 'Hourly Session' && selectedCategories.includes('Hourly Session')) categoryName = 'Hourly Session';

      if (!categoryName) return;
      if (selectedPaymentMethod && transaction.paymentMethod !== selectedPaymentMethod) return;

      if (!dailyBreakdownMap[dateKey]) {
        dailyBreakdownMap[dateKey] = {
          date: dateKey,
          categories: {
            Bill: { amount: 0, count: 0 },
            Training: { amount: 0, count: 0 },
            Membership: { amount: 0, count: 0 },
            'Hourly Session': { amount: 0, count: 0 },
            Beverage: { amount: 0, count: 0 },
          },
          paymentMethods: {
            Cash: 0,
            Bank: 0,
            bKash: 0,
          },
        };
      }

      dailyBreakdownMap[dateKey].categories[categoryName].amount += transaction.amount;
      dailyBreakdownMap[dateKey].categories[categoryName].count += 1;

      if (transaction.paymentMethod) {
        dailyBreakdownMap[dateKey].paymentMethods[transaction.paymentMethod] =
          (dailyBreakdownMap[dateKey].paymentMethods[transaction.paymentMethod] || 0) + transaction.amount;
      }
    });

    if (selectedCategories.includes('Beverage')) {
      beverageSales.forEach((sale) => {
        const dateKey = new Date(sale.date).toISOString().split('T')[0];

        if (selectedPaymentMethod && sale.paymentMethod !== selectedPaymentMethod) return;

        if (!dailyBreakdownMap[dateKey]) {
          dailyBreakdownMap[dateKey] = {
            date: dateKey,
            categories: {
              Bill: { amount: 0, count: 0 },
              Training: { amount: 0, count: 0 },
              Membership: { amount: 0, count: 0 },
              'Hourly Session': { amount: 0, count: 0 },
              Beverage: { amount: 0, count: 0 },
            },
            paymentMethods: {
              Cash: 0,
              Bank: 0,
              bKash: 0,
            },
          };
        }

        dailyBreakdownMap[dateKey].categories.Beverage.amount += sale.totalAmount;
        dailyBreakdownMap[dateKey].categories.Beverage.count += 1;

        if (sale.paymentMethod) {
          dailyBreakdownMap[dateKey].paymentMethods[sale.paymentMethod] =
            (dailyBreakdownMap[dateKey].paymentMethods[sale.paymentMethod] || 0) + sale.totalAmount;
        }
      });
    }

    const dailyTransactionBreakdown = Object.values(dailyBreakdownMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const distribution = [
      ...(selectedSections.includes('daily-entry') ? [{ name: 'Daily Entry', value: entryIncome }] : []),
      ...(selectedSections.includes('training') ? [{ name: 'Training', value: trainingIncome }] : []),
      ...(selectedSections.includes('membership') ? [{ name: 'Membership', value: membershipIncome }] : []),
      ...(selectedSections.includes('bills') ? [{ name: 'Bills', value: billIncome }] : []),
      ...(selectedSections.includes('hourly-session') ? [{ name: 'Hourly Session', value: hourlySessionIncome }] : []),
      ...(selectedSections.includes('beverages') ? [{ name: 'Beverages', value: beveragesIncome }] : []),
    ];

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
      hourlySessionIncome,
      beveragesIncome,
      totalExpense,
      expenseByCategory,
      netCash,
      timeline,
      distribution,
      dailyTransactionBreakdown,
    };

    if (dailyBalance) {
      response.dailyBalance = dailyBalance;
    }

    return res.json(response);
  } catch (err) {
    console.error('Error fetching income report:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
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
