import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { generateReceiptId } from '../utils/ids.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildSessionView = (session, now = new Date()) => {
  const startTime = new Date(session.startTime);
  const plannedEndTime = new Date(session.plannedEndTime);
  const elapsedMinutes = Math.max(0, Math.floor((now - startTime) / MS_PER_MINUTE));
  const remainingMinutes = Math.max(0, Math.ceil((plannedEndTime - now) / MS_PER_MINUTE));
  const overtimeMinutes = session.status === 'closed'
    ? Math.max(0, session.overtimeMinutes || 0)
    : Math.max(0, Math.ceil((now - plannedEndTime) / MS_PER_MINUTE));
  const baseCharge = toNumber(session.baseCharge, toNumber(session.hourlyRate, 0) * toNumber(session.plannedHours, 1));
  const overtimeCharge = session.status === 'closed'
    ? toNumber(session.overtimeCharge, 0)
    : overtimeMinutes * (toNumber(session.hourlyRate, 0) / 60);
  const beverageCharge = toNumber(session.beverageCharge, 0);
  const totalAmount = toNumber(session.totalAmount, baseCharge + overtimeCharge + beverageCharge);

  return {
    ...session.toObject(),
    elapsedMinutes,
    remainingMinutes,
    overtimeMinutes,
    baseCharge,
    overtimeCharge,
    beverageCharge,
    totalAmount,
    startTime,
    plannedEndTime,
  };
};

router.get('/active', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
    const sessions = await HourlySession.find({ companyId: req.companyId, status: 'active' }).sort({ startTime: -1 });
    return res.json({ sessions: sessions.map((session) => buildSessionView(session)) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load active sessions', error: error.message });
  }
});

router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { status } = req.query;
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
    const filter = { companyId: req.companyId };
    if (status) filter.status = status;

    const sessions = await HourlySession.find(filter).sort({ startTime: -1 }).limit(200);
    return res.json({ sessions: sessions.map((session) => buildSessionView(session)) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load sessions', error: error.message });
  }
});

router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { customerName, phone = '', memberId = null, hourlyRate, durationHours = 1, notes = '', startTime } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const rate = toNumber(hourlyRate);
    const hours = Math.max(1, toNumber(durationHours, 1));
    if (rate <= 0) {
      return res.status(400).json({ message: 'Hourly rate must be greater than 0' });
    }

    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
    const actualStartTime = startTime ? new Date(startTime) : new Date();
    const plannedEndTime = new Date(actualStartTime.getTime() + hours * MS_PER_HOUR);
    const baseCharge = rate * hours;

    const session = new HourlySession({
      companyId: req.companyId,
      customerName: customerName.trim(),
      phone: phone ? String(phone).trim() : '',
      memberId: memberId || null,
      startTime: actualStartTime,
      plannedEndTime,
      status: 'active',
      hourlyRate: rate,
      plannedHours: hours,
      baseCharge,
      notes: notes ? notes.trim() : '',
    });

    await session.save();
    return res.status(201).json({ session: buildSessionView(session) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start session', error: error.message });
  }
});

router.post('/:id/extend', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { extraHours = 1 } = req.body;
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
    const session = await HourlySession.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Only active sessions can be extended' });
    }

    const hours = Math.max(1, toNumber(extraHours, 1));
    session.plannedHours += hours;
    session.plannedEndTime = new Date(new Date(session.plannedEndTime).getTime() + hours * MS_PER_HOUR);
    session.baseCharge = toNumber(session.hourlyRate, 0) * session.plannedHours;
    await session.save();

    return res.json({ session: buildSessionView(session) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to extend session', error: error.message });
  }
});

router.post('/:id/close', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { paymentMethod = 'Cash', notes = '' } = req.body;
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');
    const Locker = getCompanyModel(req.companyDb, 'Locker');
    
    const session = await HourlySession.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Session is already closed' });
    }

    const closedAt = new Date();
    const overtimeMinutes = Math.max(0, Math.ceil((closedAt - new Date(session.plannedEndTime)) / MS_PER_MINUTE));
    const overtimeCharge = overtimeMinutes * (toNumber(session.hourlyRate, 0) / 60);
    const totalAmount = toNumber(session.baseCharge, 0) + overtimeCharge + toNumber(session.beverageCharge, 0);

    session.status = 'closed';
    session.actualEndTime = closedAt;
    session.closedAt = closedAt;
    session.overtimeMinutes = overtimeMinutes;
    session.overtimeCharge = Number(overtimeCharge.toFixed(2));
    session.totalAmount = Number(totalAmount.toFixed(2));
    session.paymentMethod = paymentMethod;
    if (notes) session.notes = notes.trim();

    const transaction = new Transaction({
      companyId: req.companyId,
      name: session.customerName,
      phone: session.phone,
      serviceType: 'Hourly Session',
      amount: session.totalAmount,
      paymentMethod,
      date: closedAt,
      receiptId: generateReceiptId(),
      transactionType: 'HourlyPayment',
      sessionId: session._id,
      overtimeMinutes,
      overtimeCharge: session.overtimeCharge,
      beverageCharge: session.beverageCharge,
    });

    await transaction.save();
    try {
      const { createIncomeEntry } = await import('../utils/journalEngine.js');
      await createIncomeEntry(req.companyDb, transaction);
    } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }
    session.transactionId = transaction._id;
    await session.save();

    // AUTO-RETURN LOCKER: If this session has an assigned locker, mark it as returned automatically
    let lockerReturned = false;
    let debugInfo = {};
    try {
      console.log(`[Hourly Sessions] Checking for locker assignment for session ${session._id}, companyId: ${req.companyId}`);
      
      // Search for locker assignment using either billPayerTransactionId or memberId
      const lockerAssignment = await LockerAssignment.findOne({
        companyId: req.companyId,
        $or: [
          { billPayerTransactionId: session._id },
          { memberId: session._id }
        ],
        status: 'Active',
      });

      debugInfo.searchQuery = {
        companyId: req.companyId,
        sessionId: session._id,
        searchFor: ['billPayerTransactionId', 'memberId']
      };
      debugInfo.assignmentFound = !!lockerAssignment;

      if (lockerAssignment) {
        console.log(`[Hourly Sessions] Found locker assignment: ${lockerAssignment._id}, lockerId: ${lockerAssignment.lockerId}, memberId: ${lockerAssignment.memberId}, billPayerTransactionId: ${lockerAssignment.billPayerTransactionId}`);
        
        lockerAssignment.returnedTime = new Date();
        lockerAssignment.status = 'Returned';
        await lockerAssignment.save();
        debugInfo.assignmentUpdated = true;

        // Mark locker as available
        const locker = await Locker.findOne({
          _id: lockerAssignment.lockerId,
          companyId: req.companyId,
        });

        if (locker) {
          locker.status = 'Available';
          await locker.save();
          lockerReturned = true;
          debugInfo.lockerUpdated = true;
          debugInfo.lockerNumber = locker.lockerNumber;
          console.log(`[Hourly Sessions] Auto-returned locker ${locker.lockerNumber} for ${session.customerName}`);
        } else {
          console.log(`[Hourly Sessions] Locker not found for ID: ${lockerAssignment.lockerId}`);
        }
      } else {
        console.log(`[Hourly Sessions] No active locker assignment found for session ${session._id}`);
      }
    } catch (lockerError) {
      console.error('[Hourly Sessions] Error auto-returning locker:', lockerError.message, lockerError.stack);
      debugInfo.error = lockerError.message;
      // Don't fail the entire operation if locker return fails
    }

    // AUTO-RETURN DRESS: If this session has an assigned dress, mark it as returned automatically
    let dressReturned = false;
    try {
      const DressRental = getCompanyModel(req.companyDb, 'DressRental');
      const Dress = getCompanyModel(req.companyDb, 'Dress');

      const dressRental = await DressRental.findOne({
        companyId: req.companyId,
        memberId: session._id,
        status: 'Active',
      });

      if (dressRental) {
        dressRental.returnedTime = new Date();
        dressRental.status = 'Returned';
        await dressRental.save();

        const dress = await Dress.findOne({
          _id: dressRental.dressId,
          companyId: req.companyId,
        });

        if (dress) {
          dress.status = 'Available';
          await dress.save();
          dressReturned = true;
          console.log(`[Hourly Sessions] Auto-returned dress ${dress.dressNumber} for ${session.customerName}`);
        }
      }
    } catch (dressError) {
      console.error('[Hourly Sessions] Error auto-returning dress:', dressError.message);
      // Don't fail the entire operation if dress return fails
    }

    return res.json({
      session: buildSessionView(session),
      transaction,
      lockerReturned,
      dressReturned,
      debug: debugInfo,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to close session', error: error.message });
  }
});

export default router;