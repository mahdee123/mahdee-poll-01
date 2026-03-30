import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

// Create expense
router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { date, title, category, amount, paymentMethod, note } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!category || !['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    if (!paymentMethod || !['Cash', 'Bank', 'bKash'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expense = new Expense({
      companyId: req.companyId,
      date: date ? new Date(date) : new Date(),
      title: title.trim(),
      category,
      amount,
      paymentMethod,
      note: note ? note.trim() : '',
    });

    await expense.save();
    return res.status(201).json({ expense });
  } catch (err) {
    console.error('Error creating expense:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Get expenses with filtering
router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    const filter = { companyId: req.companyId };

    // Date range filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Category filtering
    if (category && ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].includes(category)) {
      filter.category = category;
    }

    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expenses = await Expense.find(filter).sort({ date: -1 });
    return res.json({ expenses });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Get expense summary (total + category breakdown)
router.get('/summary', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { companyId: req.companyId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Total expense
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expenses = await Expense.find(filter);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryBreakdown = {};
    ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].forEach(cat => {
      categoryBreakdown[cat] = 0;
    });

    expenses.forEach(e => {
      categoryBreakdown[e.category] += e.amount;
    });

    return res.json({
      totalExpense,
      expenseByCategory: categoryBreakdown,
    });
  } catch (err) {
    console.error('Error fetching expense summary:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Update expense
router.patch('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, title, category, amount, paymentMethod, note } = req.body;

    // Validation
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }
    if (category !== undefined && !['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    if (paymentMethod !== undefined && !['Cash', 'Bank', 'bKash'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (title) updateData.title = title.trim();
    if (category) updateData.category = category;
    if (amount) updateData.amount = amount;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (note !== undefined) updateData.note = note.trim();

    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expense = await Expense.findByIdAndUpdate(
      { _id: id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.json({ expense });
  } catch (err) {
    console.error('Error updating expense:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

// Delete expense
router.delete('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const Expense = getCompanyModel(req.companyDb, 'Expense');
    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    return res.status(500).json({ message: 'Server error', detail: err.message });
  }
});

export default router;
