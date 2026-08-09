import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

// Parse date string in local time (avoids UTC shift from new Date("YYYY-MM-DD"))
const parseLocalDate = (dateStr) => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
};

// List daily expense summaries with filters
router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { companyId: req.companyId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = parseLocalDate(startDate);
      if (endDate) {
        const end = parseLocalDate(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');
    const expenses = await DailyExpense.find(filter).sort({ date: -1 });
    return res.json({ expenses });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Expense summary by category for a date range
router.get('/summary', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { companyId: req.companyId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = parseLocalDate(startDate);
      if (endDate) {
        const end = parseLocalDate(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');
    const expenses = await DailyExpense.find(filter).sort({ date: -1 });

    const summary = {};
    let totalAmount = 0;

    for (const expense of expenses) {
      for (const cat of (expense.categories || [])) {
        if (!summary[cat.name]) {
          summary[cat.name] = { name: cat.name, total: 0, count: 0 };
        }
        summary[cat.name].total += cat.amount || 0;
        summary[cat.name].count += 1;
        totalAmount += cat.amount || 0;
      }
    }

    return res.json({
      categories: Object.values(summary),
      totalAmount,
      recordCount: expenses.length,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Get single daily expense record
router.get('/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');
    const expense = await DailyExpense.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!expense) {
      return res.status(404).json({ error: 'Daily expense record not found' });
    }
    return res.json({ expense });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Record daily expense
// Each save creates a new record (multiple expenses per day allowed)
router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { date, categories, paymentMethod, notes } = req.body;
    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');

    if (!date || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'date and categories array are required' });
    }

    const expenseDate = new Date(date);
    expenseDate.setHours(0, 0, 0, 0);

    // Calculate total amount
    const totalAmount = categories.reduce((sum, cat) => sum + (cat.amount || 0), 0);

    // Always create a new record
    const expense = new DailyExpense({
      companyId: req.companyId,
      date: expenseDate,
      categories: categories.map(cat => ({
        name: cat.name,
        subcategory: cat.subcategory || '',
        amount: cat.amount || 0,
        notes: cat.notes || '',
      })),
      totalAmount,
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      recordedBy: req.user?.email || 'System',
    });

    await expense.save();

    // Create journal entry
    try {
      const { createExpenseEntry } = await import('../utils/journalEngine.js');
      await createExpenseEntry(req.companyDb, expense);
    } catch (je) {
      console.warn('[Journal] Failed to create expense entry:', je.message);
    }

    return res.status(201).json({ expense });
  } catch (error) {
    console.error(`[DailyExpense] ERROR in POST /:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save daily expense',
      error: error.message,
    });
  }
});

// Update daily expense summary (admin only)
router.put('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { date, categories, paymentMethod, notes } = req.body;
    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');

    const expense = await DailyExpense.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!expense) {
      return res.status(404).json({ error: 'Daily expense record not found' });
    }

    // Reverse old journal entry if it exists
    if (expense.journalEntryId) {
      try {
        const { reverseJournalEntry } = await import('../utils/journalEngine.js');
        await reverseJournalEntry(req.companyDb, req.companyId, expense.journalEntryId, 'Daily expense updated', req.user?.email || 'System');
      } catch (je) {
        console.warn('[Journal] Failed to reverse old expense entry:', je.message);
      }
    }

    // Update fields
    if (date) {
      const expenseDate = new Date(date);
      expenseDate.setHours(0, 0, 0, 0);
      expense.date = expenseDate;
    }
    if (categories) expense.categories = categories;
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (notes !== undefined) expense.notes = notes;
    expense.recordedBy = req.user?.email || 'System';

    await expense.save();

    // Create new journal entry
    try {
      const { createExpenseEntry } = await import('../utils/journalEngine.js');
      await createExpenseEntry(req.companyDb, expense);
    } catch (je) {
      console.warn('[Journal] Failed to create new expense entry:', je.message);
    }

    return res.json({ expense });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Delete daily expense summary (admin only)
router.delete('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const DailyExpense = getCompanyModel(req.companyDb, 'DailyExpense');

    const expense = await DailyExpense.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!expense) {
      return res.status(404).json({ error: 'Daily expense record not found' });
    }

    // Reverse journal entry if it exists
    if (expense.journalEntryId) {
      try {
        const { reverseJournalEntry } = await import('../utils/journalEngine.js');
        await reverseJournalEntry(req.companyDb, req.companyId, expense.journalEntryId, 'Daily expense deleted', req.user?.email || 'System');
      } catch (je) {
        console.warn('[Journal] Failed to reverse expense entry:', je.message);
      }
    }

    await DailyExpense.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    return res.json({ message: 'Daily expense deleted', expense });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
