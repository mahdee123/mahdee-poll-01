import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

/**
 * Create a new cash movement (deposit or withdrawal)
 * POST /cash-movements
 * Body: { date, type, category, amount, method, reason, reference, notes }
 */
router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { date, type, category, amount, method, reason, reference, notes } = req.body;

    // Validation
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    if (!type || !['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
      return res.status(400).json({ message: 'Type must be DEPOSIT or WITHDRAWAL' });
    }
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ message: 'Amount must be a valid positive number' });
    }
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ message: 'Reason is required' });
    }

    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');
    const parsedDate = new Date(date);
    parsedDate.setHours(0, 0, 0, 0);

    const cashMovement = new CashMovement({
      companyId: req.companyId,
      date: parsedDate,
      type,
      category,
      amount,
      method: method || 'Bank',
      reason: reason.trim(),
      reference: reference || '',
      notes: notes || '',
      createdBy: req.user?.email || '',
    });

    await cashMovement.save();
    try {
      const { createCashMovementEntry } = await import('../utils/journalEngine.js');
      await createCashMovementEntry(req.companyDb, cashMovement);
    } catch (je) { console.warn('[Journal] Failed to create cash movement entry:', je.message); }

    console.log(
      `[CashMovement] ✓ Created ${type} (${category}): ৳${amount} on ${date} (Company: ${req.companyId})`
    );

    return res.status(201).json({ success: true, cashMovement });
  } catch (error) {
    console.error(`[CashMovement] ✗ ERROR in POST /:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create cash movement',
      error: error.message,
    });
  }
});

/**
 * Get cash movements for date range
 * GET /cash-movements?startDate=2026-03-31&endDate=2026-03-31&type=DEPOSIT
 */
router.get('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, type, category } = req.query;

    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');
    const match = { companyId: req.companyId };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) {
        const from = new Date(startDate);
        from.setHours(0, 0, 0, 0);
        match.date.$gte = from;
      }
      if (endDate) {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        match.date.$lte = to;
      }
    }

    if (type) {
      match.type = type;
    }

    if (category) {
      match.category = category;
    }

    const movements = await CashMovement.find(match).sort({ date: -1, createdAt: -1 });

    return res.json({ success: true, movements });
  } catch (error) {
    console.error(`[CashMovement] ✗ ERROR in GET /:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cash movements',
      error: error.message,
    });
  }
});

/**
 * Get cash movement summary for a date range
 * GET /cash-movements/summary?startDate=2026-03-31&endDate=2026-03-31
 */
router.get('/summary', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');
    const match = { companyId: req.companyId };

    if (startDate || endDate) {
      match.date = {};
      if (startDate) {
        const from = new Date(startDate);
        from.setHours(0, 0, 0, 0);
        match.date.$gte = from;
      }
      if (endDate) {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        match.date.$lte = to;
      }
    }

    const movements = await CashMovement.find(match);

    const deposits = movements
      .filter(m => m.type === 'DEPOSIT')
      .reduce((sum, m) => sum + m.amount, 0);

    const withdrawals = movements
      .filter(m => m.type === 'WITHDRAWAL')
      .reduce((sum, m) => sum + m.amount, 0);

    const net = deposits - withdrawals;

    // Breakdown by category
    const byCategory = {};
    movements.forEach(m => {
      if (!byCategory[m.category]) {
        byCategory[m.category] = { deposits: 0, withdrawals: 0 };
      }
      if (m.type === 'DEPOSIT') {
        byCategory[m.category].deposits += m.amount;
      } else {
        byCategory[m.category].withdrawals += m.amount;
      }
    });

    return res.json({
      success: true,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      netMovement: net,
      byCategory,
      movementCount: movements.length,
    });
  } catch (error) {
    console.error(`[CashMovement] ✗ ERROR in GET /summary:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cash movement summary',
      error: error.message,
    });
  }
});

/**
 * Update a cash movement
 * PUT /cash-movements/:id
 */
router.put('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { amount, reason, notes, reference } = req.body;
    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');

    const movement = await CashMovement.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!movement) {
      return res.status(404).json({ message: 'Cash movement not found' });
    }

    if (amount !== undefined) movement.amount = amount;
    if (reason) movement.reason = reason;
    if (notes !== undefined) movement.notes = notes;
    if (reference !== undefined) movement.reference = reference;

    await movement.save();

    console.log(
      `[CashMovement] ✓ Updated cash movement (ID: ${req.params.id}, Company: ${req.companyId})`
    );

    return res.json({ success: true, cashMovement: movement });
  } catch (error) {
    console.error(`[CashMovement] ✗ ERROR in PUT /:id:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cash movement',
      error: error.message,
    });
  }
});

/**
 * Delete a cash movement
 * DELETE /cash-movements/:id
 */
router.delete('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');

    const movement = await CashMovement.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!movement) {
      return res.status(404).json({ message: 'Cash movement not found' });
    }

    await CashMovement.deleteOne({ _id: req.params.id });

    console.log(
      `[CashMovement] ✓ Deleted cash movement (ID: ${req.params.id}, Company: ${req.companyId})`
    );

    return res.json({ success: true, message: 'Cash movement deleted' });
  } catch (error) {
    console.error(`[CashMovement] ✗ ERROR in DELETE /:id:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete cash movement',
      error: error.message,
    });
  }
});

export default router;
