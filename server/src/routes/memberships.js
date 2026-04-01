import express from 'express';
import { PLAN_PRESETS } from '../utils/constants.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';
import Company from '../models/Company.js';

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
    const monthlyFee = member.monthlyFeeAmount || 2000; // Use member's fee or fallback to default
    const calculatedDue = Math.max(0, monthsSinceExpiry) * monthlyFee;
    return Math.max(member.totalDue, calculatedDue);
  }
  
  return member.totalDue || 0;
};

router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { name, phone, address, plan, startDate, amountPaid, paymentMethod, price = 0, discount = 0, monthlyFeeAmount } = req.body;
    const durationDays = PLAN_PRESETS[plan];
    const endDate = addDays(startDate, durationDays);
    
    // Calculate amount paid (default: full price after discount)
    const finalAmount = price - discount;
    const paidAmount = amountPaid !== undefined ? Number(amountPaid) : finalAmount;
    const purchaseDue = Math.max(0, finalAmount - paidAmount);
    
    const Member = getCompanyModel(req.companyDb, 'Member');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    
    // Get company default fee if not provided or invalid
    let finalMonthlyFee = Number(monthlyFeeAmount);
    if (!finalMonthlyFee || finalMonthlyFee <= 0) {
      const company = await Company.findById(req.user.companyId);
      finalMonthlyFee = company?.defaultMemberFee || 2000;
    }
    
    const member = new Member({ 
      companyId: req.user.companyId,
      name, 
      phone, 
      address, 
      plan, 
      startDate, 
      endDate,
      amountPaid: paidAmount,
      totalDue: purchaseDue,
      monthlyFeeAmount: finalMonthlyFee
    });
    
    if (purchaseDue > 0) {
      member.dueHistory = [{
        date: new Date(),
        amount: purchaseDue,
        reason: 'Initial Purchase Due',
        type: 'Due'
      }];
    }
    
    console.log(`[Membership] Attempting to save Member: ${name} (Phone: ${phone}, Plan: ${plan}, Company: ${req.companyId}, Monthly Fee: ${finalMonthlyFee})`);
    await member.save();
    console.log(`[Membership] ✓ Member saved successfully with ID: ${member._id}`);

    const transaction = new Transaction({
      companyId: req.user.companyId,
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
    console.log(`[Membership] Attempting to save Transaction for Member: ${name}`);
    await transaction.save();
    console.log(`[Membership] ✓ Transaction saved successfully with ID: ${transaction._id}`);

    return res.status(201).json({ member, transaction });
  } catch (error) {
    console.error(`[Membership] ✗ ERROR in POST /:`, error.message);
    console.error(`[Membership] Error details:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save membership',
      error: error.message,
      details: error.errors || null,
    });
  }
});

router.get('/stats', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { startDate, endDate } = req.query;
  const now = new Date();
  
  // Use provided date range or default to month view
  let rangeStart, rangeEnd;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // If custom range provided, use it
  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    // Default: month start to now
    rangeStart = new Date(monthStart);
    rangeEnd = new Date(now);
  }

  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');

  // New members in date range
  const newInRange = await Member.countDocuments({ companyId: req.user.companyId, createdAt: { $gte: rangeStart, $lte: rangeEnd } });
  const newMonth = await Member.countDocuments({ companyId: req.user.companyId, createdAt: { $gte: monthStart } });
  const activeMembers = await Member.countDocuments({ companyId: req.user.companyId, status: 'Active' });

  // Revenue from membership purchases (in date range)
  const memberIncome = await Transaction.aggregate([
    { $match: { companyId: req.user.companyId, serviceType: 'Membership', transactionType: 'Purchase', date: { $gte: rangeStart, $lte: rangeEnd } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  console.log(`[DEBUG Stats] Total Income (In Range):`, memberIncome);
  const incomeMonth = memberIncome[0]?.total || 0;

  // Total pending due - sum all totalDue from all members (regardless of status)
  const allMembers = await Member.find({ companyId: req.user.companyId });
  let totalDuePending = 0;
  console.log(`[DEBUG Stats] Members with dues:`);
  
  allMembers.forEach(m => {
    if (m.totalDue > 0) {
      console.log(`  ✓ ${m.name} (${m.status}): ${m.totalDue}৳`);
      totalDuePending += m.totalDue;
    }
  });
  console.log(`[DEBUG Stats] TOTAL PENDING DUE: ${totalDuePending}৳`);

  // Total collection (all membership payments in date range: Purchase + DuePayment + MonthlyPayment)
  const monthlyPayments = await Transaction.aggregate([
    { $match: { companyId: req.user.companyId, serviceType: 'Membership', transactionType: { $in: ['Purchase', 'DuePayment', 'MonthlyPayment'] }, date: { $gte: rangeStart, $lte: rangeEnd } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  console.log(`[DEBUG Stats] Collection result (in range):`, monthlyPayments);
  const monthlyCollection = monthlyPayments[0]?.total || 0;

  return res.json({ newInRange, newMonth, activeMembers, incomeMonth, totalDuePending, monthlyCollection, rangeStart, rangeEnd });
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
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: start, $lte: end };
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

  const amountToPay = (member.monthlyFeeAmount && member.monthlyFeeAmount > 0) ? member.monthlyFeeAmount : 2000;
  
  // Create transaction
  const transaction = new Transaction({
    companyId: req.user.companyId,
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
    companyId: req.user.companyId,
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
      companyId: req.user.companyId,
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

// GET company settings (monthly fee)
router.get('/settings/company-default', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    return res.json({
      defaultMemberFee: company.defaultMemberFee || 2000,
      feeMigrationCompleted: company.feeMigrationCompleted || false
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching company settings', error: err.message });
  }
});

// UPDATE company settings (monthly fee)
router.put('/settings/company-default', authRequired, requireRole('admin'), async (req, res) => {
  const { defaultMemberFee } = req.body;
  
  if (!defaultMemberFee || Number(defaultMemberFee) <= 0) {
    return res.status(400).json({ message: 'defaultMemberFee must be greater than 0' });
  }

  try {
    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { defaultMemberFee: Number(defaultMemberFee) },
      { new: true }
    );

    if (!company) return res.status(404).json({ message: 'Company not found' });

    return res.json({
      success: true,
      defaultMemberFee: company.defaultMemberFee,
      message: 'Default member fee updated successfully'
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating company settings', error: err.message });
  }
});

// MIGRATE existing members to use company default fee
router.put('/migrate-monthly-fees', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Member = getCompanyModel(req.companyDb, 'Member');

  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    if (company.feeMigrationCompleted) {
      return res.status(400).json({ 
        message: 'Migration already completed for this company',
        feeMigrationCompleted: true
      });
    }

    const defaultFee = company.defaultMemberFee || 2000;
    
    // Update all members without monthlyFeeAmount
    const result = await Member.updateMany(
      { companyId: req.user.companyId, monthlyFeeAmount: { $exists: false } },
      { $set: { monthlyFeeAmount: defaultFee } }
    );

    // Mark migration as completed
    company.feeMigrationCompleted = true;
    await company.save();

    return res.json({
      success: true,
      message: `Migration completed: ${result.modifiedCount} members updated with default fee ৳${defaultFee}`,
      modifiedCount: result.modifiedCount,
      defaultFee
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Migration failed',
      error: error.message
    });
  }
});

export default router;
