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
    // Parse date strings in local time to avoid UTC shift
    const [startY, startM, startD] = start.split('-').map(Number);
    const from = new Date(startY, startM - 1, startD);
    from.setHours(0, 0, 0, 0);
    const [endY, endM, endD] = end.split('-').map(Number);
    const to = new Date(endY, endM - 1, endD);
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
    const Transaction = getCompanyModel(companyDb, 'Transaction');
    const BeverageSale = getCompanyModel(companyDb, 'BeverageSale');
    const DailyExpense = getCompanyModel(companyDb, 'DailyExpense');
    
    const companyOpening = await OpeningBalance.findOne({ companyId: req.companyId });
    const initialBalance = companyOpening ? companyOpening.amount : 0;
    
    if (!companyOpening) {
      return 0;
    }
    
    const allTransactionsUpToYesterday = await Transaction.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const allBeveragesUpToYesterday = await BeverageSale.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const allExpensesUpToYesterday = await DailyExpense.find({
      companyId: req.companyId,
      date: { $lt: today }
    });
    
    const cumulativeIncome = allTransactionsUpToYesterday.reduce((sum, t) => sum + t.amount, 0) +
                             allBeveragesUpToYesterday.reduce((sum, s) => sum + s.totalAmount, 0);
    const cumulativeExpenses = allExpensesUpToYesterday.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    
    const todayOpeningBalance = initialBalance + cumulativeIncome - cumulativeExpenses;
    
    return todayOpeningBalance;
  } catch (err) {
    console.error('Error calculating opening balance:', err);
    return 0;
  }
};

// Helper function to get date key in local time (YYYY-MM-DD format)
const getLocalDateKey = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

// Helper function to calculate daily balances for a date range
const calculateDailyBalances = async (companyId, from, to, companyDb) => {
  try {
    const OpeningBalance = getCompanyModel(companyDb, 'OpeningBalance');
    const Transaction = getCompanyModel(companyDb, 'Transaction');
    const BeverageSale = getCompanyModel(companyDb, 'BeverageSale');

    const companyOpening = await OpeningBalance.findOne({ companyId });
    const initialBalance = companyOpening ? companyOpening.amount : 0;

    const allTransactionsBeforeRange = await Transaction.find({
      companyId,
      date: { $lt: from }
    });
    
    const allBeveragesBeforeRange = await BeverageSale.find({
      companyId,
      date: { $lt: from }
    });

    const cumulativeIncomeBeforeRange = 
      allTransactionsBeforeRange.reduce((sum, t) => sum + t.amount, 0) +
      allBeveragesBeforeRange.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    
    const runningOpeningBalance = initialBalance + cumulativeIncomeBeforeRange;

    const transactions = await Transaction.find({
      companyId,
      date: { $gte: from, $lte: to }
    });
    
    const beverageSales = await BeverageSale.find({
      companyId,
      date: { $gte: from, $lte: to }
    });

    const dailyMap = {};
    const currentDate = new Date(from);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dateKey = getLocalDateKey(currentDate);
      dailyMap[dateKey] = {
        date: dateKey,
        openingBalance: 0,
        transactions: {
          Bill: 0,
          Training: 0,
          Membership: 0,
          'Hourly Session': 0,
          Beverage: 0,
          totalIncome: 0
        },
        paymentMethods: {
          Cash: 0,
          Bank: 0,
          bKash: 0
        },
        expenses: {},
        closingBalance: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    transactions.forEach(t => {
      const dateKey = getLocalDateKey(t.date);
      if (dailyMap[dateKey]) {
        let categoryName = t.serviceType;
        if (t.serviceType === 'Daily Entry') categoryName = 'Bill';
        else if (t.serviceType === 'Hourly Session') categoryName = 'Hourly Session';
        
        if (dailyMap[dateKey].transactions.hasOwnProperty(categoryName)) {
          dailyMap[dateKey].transactions[categoryName] += t.amount || 0;
          dailyMap[dateKey].transactions.totalIncome += t.amount || 0;
        }
        
        if (t.paymentMethod && dailyMap[dateKey].paymentMethods.hasOwnProperty(t.paymentMethod)) {
          dailyMap[dateKey].paymentMethods[t.paymentMethod] += t.amount || 0;
        }
      }
    });

    beverageSales.forEach(sale => {
      const dateKey = getLocalDateKey(sale.date);
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].transactions.Beverage += sale.totalAmount || 0;
        dailyMap[dateKey].transactions.totalIncome += sale.totalAmount || 0;
        
        if (sale.paymentMethod && dailyMap[dateKey].paymentMethods.hasOwnProperty(sale.paymentMethod)) {
          dailyMap[dateKey].paymentMethods[sale.paymentMethod] += sale.totalAmount || 0;
        }
      }
    });

    // Fetch daily expenses for the range
    const DailyExpense = getCompanyModel(companyDb, 'DailyExpense');
    const dailyExpenses = await DailyExpense.find({
      companyId,
      date: { $gte: from, $lte: to }
    }).lean();

    // Populate expenses per day
    dailyExpenses.forEach(exp => {
      const dateKey = getLocalDateKey(exp.date);
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].expenses.totalAmount = (dailyMap[dateKey].expenses.totalAmount || 0) + (exp.totalAmount || 0);
      }
    });

    let currentRunningBalance = runningOpeningBalance;
    const sortedDates = Object.keys(dailyMap).sort();

    sortedDates.forEach(dateKey => {
      dailyMap[dateKey].openingBalance = currentRunningBalance;
      const dailyIncome = dailyMap[dateKey].transactions.totalIncome;
      const dailyExpense = dailyMap[dateKey].expenses.totalAmount || 0;
      dailyMap[dateKey].closingBalance = currentRunningBalance + dailyIncome - dailyExpense;
      currentRunningBalance = dailyMap[dateKey].closingBalance;
    });

    return Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (err) {
    console.error('Error calculating daily balances:', err);
    throw err;
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

    const totalExpense = 0;
    const expenseByCategory = {};
    const netCash = totalIncome;

    const timelineMap = {};
    filteredTransactions.forEach((transaction) => {
      const dateKey = new Date(transaction.date).toISOString().split('T')[0];
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, income: 0 };
      }
      timelineMap[dateKey].income += transaction.amount;
    });

    if (selectedSections.includes('beverages')) {
      beverageSales.forEach((sale) => {
        const dateKey = new Date(sale.date).toISOString().split('T')[0];
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = { date: dateKey, income: 0 };
        }
        timelineMap[dateKey].income += sale.totalAmount;
      });
    }

    const timeline = Object.values(timelineMap)
      .map((item) => ({
        date: item.date,
        income: item.income,
        expense: 0,
        netCash: item.income,
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
      
      // Fetch today's expenses
      const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayExpenses = await DailyExpense.find({
        companyId: req.companyId,
        date: { $gte: todayStart, $lte: todayEnd },
      }).lean();
      const dailyExpense = todayExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
      
      const closingBalance = openingBalance + totalIncome - dailyExpense;
      dailyBalance = {
        openingBalance,
        income: totalIncome,
        expense: dailyExpense,
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

// Financial Summary - Total Income and Net Profit
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
    
    const transactions = await Transaction.find(match);
    const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Net Profit (no expenses)
    const totalExpense = 0;
    const netProfit = totalIncome;

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

// Professional Business Report - Row per day with opening/closing balances and expense categories
router.get('/professional', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(400).json({ message: 'Company ID not found in request' });
    }
    
    if (!req.companyDb) {
      return res.status(400).json({ message: 'Company database not initialized' });
    }

    const { range = 'today', startDate, endDate } = req.query;
    console.log('Professional report request:', { range, startDate, endDate, companyId: req.companyId });
    
    const { from, to } = resolveRange(range, startDate, endDate);
    console.log('Resolved date range:', { from: from.toISOString(), to: to.toISOString() });

    const dailyData = await calculateDailyBalances(req.companyId, from, to, req.companyDb);
    console.log('Daily data calculated:', dailyData.length, 'days');

    // Calculate totals
    const totals = {
      openingBalance: dailyData[0]?.openingBalance || 0,
      totalIncome: 0,
      billIncome: 0,
      trainingIncome: 0,
      membershipIncome: 0,
      hourlySessionIncome: 0,
      beverageIncome: 0,
      cashIncome: 0,
      bankIncome: 0,
      bkashIncome: 0,
      totalExpense: 0,
      salaryExpense: 0,
      maintenanceExpense: 0,
      utilityExpense: 0,
      suppliesExpense: 0,
      otherExpense: 0,
      closingBalance: dailyData[dailyData.length - 1]?.closingBalance || 0,
    };

    dailyData.forEach(day => {
      totals.totalIncome += day.transactions.totalIncome;
      totals.billIncome += day.transactions.Bill;
      totals.trainingIncome += day.transactions.Training;
      totals.membershipIncome += day.transactions.Membership;
      totals.hourlySessionIncome += day.transactions['Hourly Session'];
      totals.beverageIncome += day.transactions.Beverage;
      
      totals.cashIncome += day.paymentMethods.Cash;
      totals.bankIncome += day.paymentMethods.Bank;
      totals.bkashIncome += day.paymentMethods.bKash;
    });

    console.log('Professional report response:', { dailyDataLength: dailyData.length, totals });

    return res.json({
      range,
      startDate: from.toISOString().split('T')[0],
      endDate: to.toISOString().split('T')[0],
      dailyData,
      totals,
    });
  } catch (err) {
    console.error('Error fetching professional report:', err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

export default router;
