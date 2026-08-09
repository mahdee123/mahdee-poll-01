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

// Calculate purchase due for a member (one-time admission due only)
const calculateMemberDue = (member) => {
  return member.totalDue || 0;
};

// Calculate total monthly due from dueHistory unpaid monthly entries
const calculateMonthlyDue = (member) => {
  if (!member.dueHistory || member.dueHistory.length === 0) return 0;
  return member.dueHistory
    .filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
};

// Generate monthly due entries for expired members (month-by-month tracking)
const generateMonthlyDues = (member) => {
  if (member.status === 'Inactive') return false;
  
  const now = new Date();
  const endDate = new Date(member.endDate);
  if (endDate >= now) return false;

  if (!member.dueHistory) member.dueHistory = [];

  // Find the oldest unpaid month entry to determine where to start generating
  const unpaidEntries = member.dueHistory.filter(e => e.type === 'Due' && !e.paid);
  const paidEntries = member.dueHistory.filter(e => e.type === 'Due' && e.paid);
  
  // Determine start month: first month after endDate
  const startMonth = new Date(endDate);
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  
  // Determine end month: current month
  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyFee = member.monthlyFeeAmount || 2000;
  let hasNewEntries = false;

  // Generate entries for each month from endDate to now
  let current = new Date(startMonth);
  while (current <= endMonth) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if this month already has an entry (paid or unpaid)
    const existingEntry = member.dueHistory.find(e => e.month === monthKey && e.type === 'Due');
    
    if (!existingEntry) {
      member.dueHistory.push({
        month: monthKey,
        amount: monthlyFee,
        paid: false,
        date: new Date(current),
        reason: `Monthly Fee - ${current.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        type: 'Due'
      });
      hasNewEntries = true;
    }
    
    current.setMonth(current.getMonth() + 1);
  }

  return hasNewEntries;
};

router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { name, phone, address, plan, startDate, amountPaid, paymentMethod, price = 0, discount = 0, monthlyFeeAmount } = req.body;
    
    // Get plan settings from DB packages array, fallback to defaults
    const company = await Company.findById(req.user.companyId);
    const packages = company?.membershipSettings?.packages || [];
    const planPkg = packages.find(p => p.title === plan);
    
    const durationMonths = planPkg?.duration || 1;
    const durationDays = durationMonths * 30;
    const endDate = addDays(startDate, durationDays);
    
    // Calculate amount paid (default: full price after discount)
    const finalAmount = price - discount;
    const paidAmount = amountPaid !== undefined ? Number(amountPaid) : finalAmount;
    const purchaseDue = Math.max(0, finalAmount - paidAmount);
    
    const Member = getCompanyModel(req.companyDb, 'Member');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    
    // Get monthly fee: request body > plan settings > company default > 2000
    let finalMonthlyFee = Number(monthlyFeeAmount);
    if (!finalMonthlyFee || finalMonthlyFee <= 0) {
      finalMonthlyFee = planPkg?.monthlyFee || company?.defaultMemberFee || 2000;
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
    try {
      const { createIncomeEntry } = await import('../utils/journalEngine.js');
      await createIncomeEntry(req.companyDb, transaction);
    } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }
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

router.get('/stats', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
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
  const activeMembers = await Member.countDocuments({ companyId: req.user.companyId, endDate: { $gt: now }, status: { $ne: 'Inactive' }, totalDue: { $lte: 0 } });

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

// GET membership stats trend (for mini charts and trend percentages)
router.get('/stats/trend', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Use provided date range or default to today
    let rangeStart, rangeEnd;
    if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeStart = todayStart;
      rangeEnd = now;
    }

    // Previous period (same duration, before rangeStart)
    const rangeDuration = rangeEnd.getTime() - rangeStart.getTime();
    const prevRangeEnd = new Date(rangeStart);
    prevRangeEnd.setSeconds(prevRangeEnd.getSeconds() - 1);
    const prevRangeStart = new Date(prevRangeEnd.getTime() - rangeDuration);

    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const Member = getCompanyModel(req.companyDb, 'Member');

    // Current period income
    const currentIncomeAgg = await Transaction.aggregate([
      { $match: { companyId: req.user.companyId, serviceType: 'Membership', date: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const currentIncome = currentIncomeAgg[0]?.total || 0;
    const currentCount = currentIncomeAgg[0]?.count || 0;

    // Previous period income
    const prevIncomeAgg = await Transaction.aggregate([
      { $match: { companyId: req.user.companyId, serviceType: 'Membership', date: { $gte: prevRangeStart, $lte: prevRangeEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const prevIncome = prevIncomeAgg[0]?.total || 0;

    // Current period members vs previous
    const currentMembers = await Member.countDocuments({ companyId: req.user.companyId, createdAt: { $gte: rangeStart, $lte: rangeEnd } });
    const prevMembers = await Member.countDocuments({ companyId: req.user.companyId, createdAt: { $gte: prevRangeStart, $lte: prevRangeEnd } });

    // Daily timeline for mini chart (last 7 days)
    const dailyTimeline = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayAgg = await Transaction.aggregate([
        { $match: { companyId: req.user.companyId, serviceType: 'Membership', date: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      dailyTimeline.push({
        day: dayStart.toLocaleString('en-US', { weekday: 'short' }),
        value: dayAgg[0]?.total || 0
      });
    }

    return res.json({
      currentIncome,
      currentCount,
      prevIncome,
      currentMembers,
      prevMembers,
      dailyTimeline
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching trend data', error: err.message });
  }
});

router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
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
  let members = await Member.find(query).sort({ createdAt: -1 });
  
  // Auto-generate monthly dues for expired members and save if changed
  let membersToSave = [];
  for (const member of members) {
    if (member.status !== 'Inactive' && new Date(member.endDate) < new Date()) {
      const hadChanges = generateMonthlyDues(member);
      if (hadChanges) {
        membersToSave.push(member);
      }
    }
  }
  
  // Save any members that got new due entries
  if (membersToSave.length > 0) {
    await Promise.all(membersToSave.map(m => m.save()));
    // Re-fetch to get saved data
    members = await Member.find(query).sort({ createdAt: -1 });
  }
  
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
router.get('/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
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
router.get('/:id/due', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  const Member = getCompanyModel(req.companyDb, 'Member');
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  const purchaseDue = calculateMemberDue(member);
  const monthlyDueTotal = calculateMonthlyDue(member);
  const unpaidMonths = (member.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && !e.paid);
  const paidMonths = (member.dueHistory || []).filter(e => e.type === 'Due' && e.reason?.startsWith('Monthly Fee') && e.paid);
  
  let nextDueDate = null;
  if (unpaidMonths.length > 0) {
    nextDueDate = new Date(unpaidMonths[0].date || new Date());
  }

  return res.json({
    purchaseDue,
    monthlyDueTotal,
    unpaidMonths,
    paidMonths,
    lastPaymentDate: member.lastPaymentDate,
    nextDueDate,
    status: member.status,
    dueHistory: member.dueHistory || []
  });
});

// PAY monthly fee (collects oldest unpaid month)
router.post('/:id/pay-monthly', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { paymentMethod = 'Cash' } = req.body;
  
  const Member = getCompanyModel(req.companyDb, 'Member');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });

  // Ensure dueHistory exists
  if (!member.dueHistory) member.dueHistory = [];

  // Find the oldest unpaid month
  const oldestUnpaid = member.dueHistory.find(e => e.type === 'Due' && !e.paid);
  if (!oldestUnpaid) {
    return res.status(400).json({ message: 'No unpaid months to collect' });
  }

  const amountToPay = oldestUnpaid.amount || (member.monthlyFeeAmount || 2000);
  
  // Mark this month as paid
  oldestUnpaid.paid = true;
  oldestUnpaid.paidDate = new Date();
  
  // Create transaction with month info
  const monthDate = new Date(oldestUnpaid.date || new Date());
  const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  
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
  try {
    const { createIncomeEntry } = await import('../utils/journalEngine.js');
    await createIncomeEntry(req.companyDb, transaction);
  } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }

  // Update member
  member.lastPaymentDate = new Date();

  await member.save();

  return res.status(201).json({
    success: true,
    transaction,
    collectedMonth: oldestUnpaid.month,
    collectedMonthName: monthName,
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
  try {
    const { createIncomeEntry } = await import('../utils/journalEngine.js');
    await createIncomeEntry(req.companyDb, transaction);
  } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }

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
router.get('/:id/payment-history', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
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
router.get('/settings/company-default', authRequired, requireRole('admin', 'manager'), async (req, res) => {
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

// Default settings for new companies
const defaultMembershipSettings = {
  baseFees: {
    admissionFee: { enabled: true, amount: 2500 },
        monthlyFee: { enabled: true, amount: 2000 },
      },
      packages: [
        { title: 'Monthly', duration: 1, amount: 6500, monthlyFee: 2000, color: '#3B82F6', admissionFee: true },
        { title: 'Quarterly', duration: 3, amount: 10000, monthlyFee: 2000, color: '#8B5CF6', admissionFee: true },
        { title: 'Half Yearly', duration: 6, amount: 17000, monthlyFee: 2000, color: '#F59E0B', admissionFee: true },
        { title: 'Yearly', duration: 12, amount: 30000, monthlyFee: 2000, color: '#22C55E', admissionFee: true },
      ],
      autoInactiveMonths: 3,
};

// GET membership settings
router.get('/settings/membership', authRequired, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Handle migration from old format
    let settings = company.membershipSettings;
    if (!settings || !settings.packages) {
      settings = defaultMembershipSettings;
    }

    return res.json({ settings });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching membership settings', error: err.message });
  }
});

// PUT membership settings
router.put('/settings/membership', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { baseFees, packages, autoInactiveMonths } = req.body;
    
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    if (!company.membershipSettings) {
      company.membershipSettings = {};
    }

    if (baseFees) {
      company.membershipSettings.baseFees = {
        admissionFee: {
          enabled: Boolean(baseFees.admissionFee?.enabled),
          amount: Number(baseFees.admissionFee?.amount) || 0,
        },
        monthlyFee: {
          enabled: Boolean(baseFees.monthlyFee?.enabled),
          amount: Number(baseFees.monthlyFee?.amount) || 0,
        },
      };
      // Sync defaultMemberFee
      company.defaultMemberFee = company.membershipSettings.baseFees.monthlyFee.amount;
    }

    if (packages) {
      company.membershipSettings.packages = packages.map(p => ({
        title: p.title,
        duration: Number(p.duration) || 1,
        amount: Number(p.amount) || 0,
        monthlyFee: Number(p.monthlyFee) || 0,
        color: p.color || '#6366F1',
        admissionFee: Boolean(p.admissionFee),
      }));
    }

    if (autoInactiveMonths !== undefined) {
      company.membershipSettings.autoInactiveMonths = Number(autoInactiveMonths);
    }

    await company.save();

    return res.json({
      success: true,
      settings: company.membershipSettings,
      message: 'Membership settings updated successfully'
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating membership settings', error: err.message });
  }
});

export default router;
