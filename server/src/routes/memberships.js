import express from 'express';
import { PLAN_PRESETS } from '../utils/constants.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Calculate current due for a member
const calculateMemberDue = (member) => {
  if (member.status === 'Inactive' || member.status === 'Active') {
    return 0;
  }
  
  if (member.status === 'Expired') {
    const now = new Date();
    const monthsSinceExpiry = Math.floor((now - new Date(member.endDate)) / (1000 * 60 * 60 * 24 * 30));
    const calculatedDue = Math.max(0, monthsSinceExpiry) * 2000;
    return Math.max(member.totalDue, calculatedDue);
  }
  
  return member.totalDue || 0;
};

router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { name, phone, address, plan, startDate, amountPaid, paymentMethod, price = 0, discount = 0 } = req.body;
  const durationDays = PLAN_PRESETS[plan];
  const endDate = addDays(startDate, durationDays);
  
  // Calculate amount paid (default: full price after discount)
  const finalAmount = price - discount;
  const paidAmount = amountPaid !== undefined ? Number(amountPaid) : finalAmount;
  const purchaseDue = Math.max(0, finalAmount - paidAmount);
  
  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const member = new Member({ 
    companyId: req.companyId,
    name, 
    phone, 
    address, 
    plan, 
    startDate, 
    endDate,
    amountPaid: paidAmount,
    totalDue: purchaseDue
  });
  
  if (purchaseDue > 0) {
    member.dueHistory = [{
      date: new Date(),
      amount: purchaseDue,
      reason: 'Initial Purchase Due',
      type: 'Due'
    }];
  }
  
  await member.save();

  const transaction = new Transaction({
    companyId: req.companyId,
    name,
    phone,
    serviceType: 'Membership',
    amount: paidAmount,
    paymentMethod: paymentMethod || 'Cash',
    receiptId: generateReceiptId(),
    date: new Date(),
    memberId: member._id,
    transactionType: 'Purchase',
    amountPaid: paidAmount,
    dueAmount: purchaseDue,
    // Receipt context
    price,
    discount,
    plan,
    duration: durationDays,
    startDate
  });
  await transaction.save();

  return res.status(201).json({ member, transaction });
});

router.get('/stats', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');

  const newToday = await Member.countDocuments({ companyId: req.companyId, createdAt: { $gte: todayStart } });
  const newMonth = await Member.countDocuments({ companyId: req.companyId, createdAt: { $gte: monthStart } });
  const activeMembers = await Member.countDocuments({ companyId: req.companyId, status: 'Active' });

  // Revenue from membership purchases
  const memberRevenue = await Transaction.aggregate([
    { $match: { companyId: req.companyId, serviceType: 'Membership', transactionType: 'Purchase', date: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const revenueMonth = memberRevenue[0]?.total || 0;

  // Total pending due for non-inactive members
  const expiredMembers = await Member.find({ companyId: req.companyId, status: 'Expired' });
  let totalDuePending = 0;
  expiredMembers.forEach(member => {
    totalDuePending += calculateMemberDue(member);
  });

  // Monthly collection (payments this month)
  const monthlyPayments = await Transaction.aggregate([
    { $match: { companyId: req.companyId, serviceType: 'Membership', transactionType: 'MonthlyPayment', date: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const monthlyCollection = monthlyPayments[0]?.total || 0;

  return res.json({ newToday, newMonth, activeMembers, revenueMonth, totalDuePending, monthlyCollection });
});

router.get('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { status, search, plan, startDate, endDate } = req.query;
  const query = { companyId: req.companyId };
  
  if (status) query.status = status;
  if (plan) query.plan = plan;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (startDate && endDate) {
    query.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const Member = getCompanyModel(req.companyDb, 'Member');
  const members = await Member.find(query).sort({ createdAt: -1 });
  return res.json({ members });
});

router.patch('/:id/status', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { status } = req.body;
  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findByIdAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { status },
    { new: true }
  );
  if (!member) return res.status(404).json({ message: 'Member not found' });
  return res.json({ member });
});

// GET single member (for profile view)
router.get('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!member) return res.status(404).json({ message: 'Member not found' });
  return res.json({ member });
});

// UPDATE member profile
router.put('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { name, phone, address, plan } = req.body;
  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!member) return res.status(404).json({ message: 'Member not found' });

  if (name) member.name = name;
  if (phone) member.phone = phone;
  if (address) member.address = address;
  if (plan) {
    const newDurationDays = PLAN_PRESETS[plan];
    if (!newDurationDays) return res.status(400).json({ message: 'Invalid plan' });
    member.plan = plan;
    member.endDate = addDays(member.startDate, newDurationDays);
  }

  await member.save();
  return res.json({ member });
});

// CHANGE member status
router.post('/:id/status', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Active', 'Expired', 'Inactive'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  member.status = status;
  
  // If reactivating, reset due
  if (status === 'Active') {
    member.totalDue = 0;
    member.dueHistory = [];
  }
  
  await member.save();
  return res.json({ member });
});

// GET member's due information
router.get('/:id/due', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  const totalDue = calculateMemberDue(member);
  const monthsSinceExpiry = Math.max(0, Math.floor((new Date() - new Date(member.endDate)) / (1000 * 60 * 60 * 24 * 30)));
  
  let nextDueDate = null;
  if (member.lastPaymentDate) {
    nextDueDate = new Date(member.lastPaymentDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  } else if (member.status === 'Expired') {
    nextDueDate = new Date(member.endDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  return res.json({
    totalDue,
    lastPaymentDate: member.lastPaymentDate,
    nextDueDate,
    monthsSinceExpiry,
    status: member.status,
    dueHistory: member.dueHistory || []
  });
});

// PAY monthly fee
router.post('/:id/pay-monthly', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { paymentMethod = 'Cash' } = req.body;
  
  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  if (member.status !== 'Expired') {
    return res.status(400).json({ message: 'Only expired members can pay monthly fee' });
  }

  const amountToPay = 2000;
  
  // Create transaction
  const transaction = new Transaction({
    companyId: req.companyId,
    name: member.name,
    phone: member.phone,
    serviceType: 'Membership',
    amount: amountToPay,
    paymentMethod,
    receiptId: generateReceiptId(),
    date: new Date(),
    memberId: member._id,
    transactionType: 'MonthlyPayment'
  });
  await transaction.save();

  // Update member
  member.totalDue = Math.max(0, calculateMemberDue(member) - amountToPay);
  member.lastPaymentDate = new Date();
  
  // Add to due history
  if (!member.dueHistory) member.dueHistory = [];
  member.dueHistory.push({
    date: new Date(),
    amount: -amountToPay,
    reason: 'Monthly Payment',
    type: 'Payment'
  });

  await member.save();

  return res.status(201).json({
    success: true,
    transaction,
    member: {
      _id: member._id,
      name: member.name,
      totalDue: member.totalDue,
      lastPaymentDate: member.lastPaymentDate,
      status: member.status
    }
  });
});

// PAY any due amount (purchase or other)
router.post('/:id/pay-due', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { paymentAmount, paymentMethod = 'Cash' } = req.body;
  
  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  if (member.totalDue <= 0) {
    return res.status(400).json({ message: 'No due amount for this member' });
  }

  const paymentAmountNum = Number(paymentAmount);
  if (!paymentAmountNum || paymentAmountNum <= 0) {
    return res.status(400).json({ message: 'Payment amount must be greater than 0' });
  }

  if (!paymentMethod || !['Cash', 'Bank', 'bKash'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }

  // Handle advance credit (apply credit first, then new payment)
  let remainingPayment = paymentAmountNum;
  let creditUsed = 0;
  
  if (member.advanceCredit && member.advanceCredit > 0) {
    creditUsed = Math.min(member.advanceCredit, member.totalDue);
    member.advanceCredit -= creditUsed;
    member.totalDue -= creditUsed;
  }

  // Handle overpayment: if paying more than due
  let newAdvanceCredit = 0;
  let actualPaymentAgainstDue = remainingPayment;
  
  if (remainingPayment > member.totalDue) {
    newAdvanceCredit = remainingPayment - member.totalDue;
    actualPaymentAgainstDue = member.totalDue;
    member.advanceCredit = (member.advanceCredit || 0) + newAdvanceCredit;
  }

  // Create transaction (record full payment)
  const transaction = new Transaction({
    companyId: req.companyId,
    name: member.name,
    phone: member.phone,
    serviceType: 'Membership',
    amount: paymentAmountNum,
    paymentMethod,
    receiptId: generateReceiptId(),
    date: new Date(),
    memberId: member._id,
    transactionType: 'DuePayment',
    amountPaid: paymentAmountNum,
    dueAmount: Math.max(0, member.totalDue - actualPaymentAgainstDue)
  });
  await transaction.save();

  // Update member due
  member.totalDue = Math.max(0, member.totalDue - actualPaymentAgainstDue);
  member.lastPaymentDate = new Date();
  
  // Add to due history
  if (!member.dueHistory) member.dueHistory = [];
  member.dueHistory.push({
    date: new Date(),
    amount: -paymentAmountNum,
    reason: 'Payment',
    type: 'Payment'
  });

  await member.save();

  return res.status(201).json({
    success: true,
    transaction,
    member: {
      _id: member._id,
      name: member.name,
      phone: member.phone,
      totalDue: member.totalDue,
      advanceCredit: member.advanceCredit,
      lastPaymentDate: member.lastPaymentDate,
      status: member.status
    }
  });
});

// GET payment history for a member
router.get('/:id/payment-history', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  try {
    const transactions = await Transaction.find({
      companyId: req.companyId,
      memberId: req.params.id,
      transactionType: { $in: ['DuePayment', 'MonthlyPayment'] }
    }).sort({ date: -1 });

    const paymentHistory = transactions.map(t => ({
      _id: t._id,
      date: t.date,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      receiptId: t.receiptId,
      transactionType: t.transactionType,
      createdAt: t.createdAt
    }));

    return res.json({ paymentHistory });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching payment history', error: err.message });
  }
});

export default router;

