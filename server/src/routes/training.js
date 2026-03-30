import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { BATCH_PRESETS, SLOT_LIMIT, CLASS_SLOTS } from '../utils/constants.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const deriveBatchDetails = ({ ageGroup, batchType }) => {
  const preset = BATCH_PRESETS[batchType];
  const key = ageGroup === '4-8' ? 'kids' : 'adults';
  return {
    totalClasses: preset.totalClasses[key],
    price: preset.pricing[key],
    durationDays: preset.days,
  };
};

const validateSlot = (timeSlot, classSlot) => {
  if (classSlot === 1 || classSlot === 2) return timeSlot === 'Morning';
  if (classSlot === 3 || classSlot === 4) return timeSlot === 'Evening';
  return false;
};

router.post('/students', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { name, phone, ageGroup, batchType, startDate, timeSlot, classSlot, discount = 0, amountPaid, paymentMethod = 'Cash' } = req.body;
  const Student = getCompanyModel(req.companyDb, 'Student');
  const ClassRecord = getCompanyModel(req.companyDb, 'ClassRecord');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  if (!validateSlot(timeSlot, Number(classSlot))) {
    return res.status(400).json({ message: 'Time slot and class slot mismatch' });
  }
  
  const slotCount = await Student.countDocuments({
    companyId: req.companyId,
    classSlot,
    status: 'active',
    endDate: { $gte: new Date(startDate) },
  });
  
  if (slotCount >= SLOT_LIMIT) {
    return res.status(400).json({ message: 'Selected class slot is full (15 students)' });
  }

  const { totalClasses, price, durationDays } = deriveBatchDetails({ ageGroup, batchType });
  const endDate = addDays(startDate, durationDays);
  
  // Calculate final amount after discount
  const discountAmount = Number(discount) || 0;
  const finalAmount = Math.max(0, price - discountAmount);
  const paidAmount = amountPaid !== undefined ? Number(amountPaid) : finalAmount;
  const dueAmount = Math.max(0, finalAmount - paidAmount);
  
  const student = new Student({
    companyId: req.companyId,
    name,
    phone,
    ageGroup,
    batchType,
    timeSlot,
    classSlot,
    totalClasses,
    remainingClasses: totalClasses,
    price,
    discount: discountAmount,
    durationDays,
    startDate,
    endDate,
    amountPaid: paidAmount,
    due: dueAmount,
  });
  
  if (dueAmount > 0) {
    student.dueHistory = [{
      date: new Date(),
      amount: dueAmount,
      reason: 'Initial Purchase Due',
      type: 'Due'
    }];
  }
  
  await student.save();

  // Auto-create transaction
  const transaction = new Transaction({
    companyId: req.companyId,
    name,
    phone,
    serviceType: 'Training',
    amount: paidAmount,
    paymentMethod,
    date: new Date(),
    receiptId: generateReceiptId(),
    studentId: student._id,
    transactionType: 'Purchase',
    amountPaid: paidAmount,
    dueAmount: dueAmount,
    // Receipt context
    price,
    discount: discountAmount,
    package: `${totalClasses} Classes`,
    batch: batchType,
    duration: durationDays,
  });
  
  await transaction.save();

  return res.status(201).json({ student, transaction });
});

router.get('/students', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Student = getCompanyModel(req.companyDb, 'Student');
  const students = await Student.find({ companyId: req.companyId }).sort({ createdAt: -1 });
  return res.json({ students });
});

router.post('/students/:id/classes', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { status, date } = req.body;
  const Student = getCompanyModel(req.companyDb, 'Student');
  const ClassRecord = getCompanyModel(req.companyDb, 'ClassRecord');
  
  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const recordDate = new Date(date || new Date());
  if (recordDate > student.endDate) {
    student.status = 'expired';
    await student.save();
    return res.status(400).json({ message: 'Student is expired' });
  }
  if (status === 'Makeup' && student.makeupUsed >= 2) {
    return res.status(400).json({ message: 'Max 2 makeup classes reached' });
  }
  if (student.remainingClasses <= 0) {
    student.status = 'expired';
    await student.save();
    return res.status(400).json({ message: 'No remaining classes' });
  }

  const record = new ClassRecord({ companyId: req.companyId, student: student._id, status, date: recordDate });
  await record.save();

  if (status === 'Attended' || status === 'Makeup') {
    student.remainingClasses = Math.max(0, student.remainingClasses - 1);
  }
  if (status === 'Makeup') {
    student.makeupUsed += 1;
  }
  if (recordDate > student.endDate || student.remainingClasses === 0) {
    student.status = 'expired';
  }
  await student.save();
  return res.status(201).json({ record, student });
});

router.get('/dashboard', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  const Student = getCompanyModel(req.companyDb, 'Student');
  const ClassRecord = getCompanyModel(req.companyDb, 'ClassRecord');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  
  const students = await Student.find({ companyId: req.companyId, endDate: { $gte: today } });
  const classRecords = await ClassRecord.find({ companyId: req.companyId, date: { $gte: addDays(today, -30) } }).populate('student', 'classSlot');
  
  // Calculate training income and due for this month
  const monthStudents = await Student.find({
    companyId: req.companyId,
    createdAt: { $gte: monthStart, $lte: monthEnd }
  });
  const trainingIncome = monthStudents.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const trainingDue = monthStudents.reduce((sum, s) => sum + (s.due || 0), 0);

  const summary = [1, 2, 3, 4].map((slot) => {
    const slotStudents = students.filter((s) => s.classSlot === slot);
    const slotRecords = classRecords.filter((r) => r.student.classSlot === slot);
    const attended = slotRecords.filter((r) => r.status === 'Attended').length;
    const missed = slotRecords.filter((r) => r.status === 'Missed').length;
    const makeup = slotRecords.filter((r) => r.status === 'Makeup').length;
    return {
      classSlot: slot,
      label: CLASS_SLOTS[slot].label,
      time: CLASS_SLOTS[slot].time,
      totalStudents: slotStudents.length,
      availableSeats: Math.max(0, SLOT_LIMIT - slotStudents.length),
      attended,
      missed,
      makeup,
    };
  });

  const remainingByStudent = students.map((s) => ({
    id: s._id,
    name: s.name,
    phone: s.phone,
    classSlot: s.classSlot,
    remainingClasses: s.remainingClasses,
    endDate: s.endDate,
  }));

  return res.json({ summary, remainingByStudent, trainingIncome, trainingDue });
});

router.get('/students/:id/progress', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Student = getCompanyModel(req.companyDb, 'Student');
  const ClassRecord = getCompanyModel(req.companyDb, 'ClassRecord');
  
  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const records = await ClassRecord.find({ companyId: req.companyId, student: student._id }).sort({ date: -1 });
  return res.json({ student, records });
});

// GET single student (for profile view)
router.get('/students/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Student = getCompanyModel(req.companyDb, 'Student');
  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  return res.json({ student });
});

// PAY student due amount
router.post('/students/:id/pay-due', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { paymentAmount, paymentMethod = 'Cash' } = req.body;
  const Student = getCompanyModel(req.companyDb, 'Student');
  const Transaction = getCompanyModel(req.companyDb, 'Transaction');
  
  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  if (student.due <= 0) {
    return res.status(400).json({ message: 'No due amount for this student' });
  }

  const amountToPay = Math.min(Number(paymentAmount) || student.due, student.due);
  
  if (amountToPay <= 0) {
    return res.status(400).json({ message: 'Payment amount must be greater than 0' });
  }

  // Create transaction
  const transaction = new Transaction({
    companyId: req.companyId,
    name: student.name,
    phone: student.phone,
    serviceType: 'Training',
    amount: amountToPay,
    paymentMethod,
    receiptId: generateReceiptId(),
    date: new Date(),
    studentId: student._id,
    transactionType: 'DuePayment',
    amountPaid: amountToPay,
    dueAmount: student.due - amountToPay
  });
  await transaction.save();

  // Update student
  student.due = Math.max(0, student.due - amountToPay);
  
  // Add to due history
  if (!student.dueHistory) student.dueHistory = [];
  student.dueHistory.push({
    date: new Date(),
    amount: -amountToPay,
    reason: 'Payment',
    type: 'Payment'
  });

  await student.save();

  return res.status(201).json({
    success: true,
    transaction,
    student: {
      _id: student._id,
      name: student.name,
      phone: student.phone,
      due: student.due,
      amountPaid: student.amountPaid
    }
  });
});

// GET class history for student
router.get('/students/:id/history', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Student = getCompanyModel(req.companyDb, 'Student');
  const ClassRecord = getCompanyModel(req.companyDb, 'ClassRecord');
  
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const records = await ClassRecord.find({ companyId: req.companyId, student: student._id }).sort({ date: -1 });
  return res.json({ records });
});

// UPDATE student profile
router.put('/students/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { name, phone, batchType, classSlot, endDate, discount, amountPaid } = req.body;
  const Student = getCompanyModel(req.companyDb, 'Student');
  
  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  // Validate slot change if changing classSlot
  if (classSlot && classSlot !== student.classSlot) {
    const slotCount = await Student.countDocuments({
      companyId: req.companyId,
      classSlot,
      status: 'active',
      endDate: { $gte: new Date() },
      _id: { $ne: student._id },
    });
    if (slotCount >= SLOT_LIMIT) {
      return res.status(400).json({ message: 'Selected class slot is full' });
    }
  }

  // Update fields
  if (name) student.name = name;
  if (phone) student.phone = phone;
  if (batchType) {
    const { durationDays } = deriveBatchDetails({ ageGroup: student.ageGroup, batchType });
    student.batchType = batchType;
    student.durationDays = durationDays;
  }
  if (classSlot) student.classSlot = classSlot;
  if (endDate) student.endDate = new Date(endDate);
  
  // Update discount and payment info if provided
  if (discount !== undefined) {
    const discountAmount = Number(discount) || 0;
    student.discount = discountAmount;
    // Recalculate due amount
    const finalAmount = Math.max(0, student.price - discountAmount);
    const paid = amountPaid !== undefined ? Number(amountPaid) : student.amountPaid;
    student.amountPaid = paid;
    student.due = Math.max(0, finalAmount - paid);
  } else if (amountPaid !== undefined) {
    const paid = Number(amountPaid) || 0;
    student.amountPaid = paid;
    const finalAmount = Math.max(0, student.price - (student.discount || 0));
    student.due = Math.max(0, finalAmount - paid);
  }

  await student.save();
  return res.json({ student });
});

// CHANGE student status
router.post('/students/:id/status', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const { status } = req.body;
  const Student = getCompanyModel(req.companyDb, 'Student');
  
  const validStatuses = ['active', 'completed', 'expired'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const student = await Student.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  student.status = status;
  await student.save();
  return res.json({ student });
});

export default router;
