import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

// Create transaction
router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const {
      name,
      phone,
      serviceType,
      amount,
      paymentMethod,
      timeSlot,
      price,
      discount,
      package: pkg,
      batch,
      duration,
      plan,
      startDate,
      amountPerPerson,
      numberOfPersons,
    } = req.body;
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    const transaction = new Transaction({
      companyId: req.companyId,
      name,
      phone,
      serviceType,
      amount,
      paymentMethod,
      timeSlot,
      receiptId: generateReceiptId(),
      date: new Date(),
      price: price || undefined,
      discount: discount || 0,
      package: pkg || undefined,
      batch,
      duration,
      plan,
      startDate,
      amountPerPerson,
      numberOfPersons: numberOfPersons || 1,
    });

    await transaction.save();
    return res.status(201).json({ transaction });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Get transactions with advanced filtering
router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, serviceType, paymentMethod, amountPerPerson } = req.query;
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

    if (serviceType) filter.serviceType = serviceType;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (amountPerPerson) filter.amountPerPerson = Number(amountPerPerson);

    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const transactions = await Transaction.find(filter).sort({ date: -1 });
    return res.json({ transactions });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Get bills only (serviceType = 'Bill')
router.get('/bills/list', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, amountPerPerson, search } = req.query;
    const filter = { companyId: req.companyId, serviceType: 'Bill' };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (amountPerPerson) filter.amountPerPerson = Number(amountPerPerson);

    // Search by name or phone
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const bills = await Transaction.find(filter).sort({ date: -1 });
    return res.json({ bills });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Get bill statistics
router.get('/stats/bills', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Today stats
    const todayBills = await Transaction.find({
      companyId: req.companyId,
      serviceType: 'Bill',
      date: { $gte: today, $lt: tomorrow },
    });

    const totalBillsToday = todayBills.length;
    const todayRevenue = todayBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPersonsToday = todayBills.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0);
    const todayCustomers = new Set(
      todayBills.map((b) => (b.phone || b.name || b._id)).filter(Boolean)
    ).size;

    // Month stats
    const monthBills = await Transaction.find({
      companyId: req.companyId,
      serviceType: 'Bill',
      date: { $gte: monthStart, $lte: monthEnd },
    });

    const monthRevenue = monthBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPersonsThisMonth = monthBills.reduce((sum, b) => sum + (b.numberOfPersons || 1), 0);

    return res.json({
      totalBillsToday,
      todayRevenue,
      totalPersonsToday,
      thisMonthRevenue: monthRevenue,
      totalPersonsThisMonth,
      totalCustomersToday: todayCustomers,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Delete transaction
router.delete('/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const transaction = await Transaction.findOneAndDelete(
      { _id: req.params.id, companyId: req.companyId }
    );
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    return res.json({ message: 'Transaction deleted', transaction });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
