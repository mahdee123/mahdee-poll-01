import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';
import { createJournalEntry, reverseJournalEntry } from '../utils/journalEngine.js';

const router = express.Router();

// List journal entries with filters
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { startDate, endDate, referenceType, accountCode } = req.query;
    const JournalEntry = getCompanyModel(req.companyDb, 'JournalEntry');

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

    if (referenceType) filter.referenceType = referenceType;
    if (accountCode) filter['lines.accountCode'] = accountCode;

    const entries = await JournalEntry.find(filter).sort({ date: -1 }).lean();
    return res.json({ entries });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get single journal entry
router.get('/:id', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const JournalEntry = getCompanyModel(req.companyDb, 'JournalEntry');
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    }).lean();

    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    return res.json({ entry });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create manual journal entry (admin only)
router.post('/manual', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { date, description, lines } = req.body;

    if (!date || !description || !lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Date, description, and lines array are required' });
    }

    for (const line of lines) {
      if (!line.accountCode) {
        return res.status(400).json({ error: 'Each line must have an accountCode' });
      }
      if ((line.debit || 0) < 0 || (line.credit || 0) < 0) {
        return res.status(400).json({ error: 'Debit and credit amounts cannot be negative' });
      }
    }

    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: `Entry does not balance: debit ${totalDebit} != credit ${totalCredit}`,
      });
    }

    const entry = await createJournalEntry(req.companyDb, req.companyId, {
      date,
      description,
      referenceType: 'Manual',
      lines,
      createdBy: req.user?.name || req.user?.email || 'Admin',
    });

    return res.status(201).json({ entry });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Reverse a journal entry (admin only)
router.post('/:id/reverse', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason for reversal is required' });
    }

    const reversal = await reverseJournalEntry(
      req.companyDb,
      req.companyId,
      req.params.id,
      reason,
      req.user?.name || req.user?.email || 'Admin'
    );

    return res.status(201).json({ entry: reversal });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Cannot reverse')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

// Backfill journal entries from existing transactions and cash movements
router.post('/backfill', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const CashMovement = getCompanyModel(req.companyDb, 'CashMovement');
    const JournalEntry = getCompanyModel(req.companyDb, 'JournalEntry');

    // Get all existing journal entry reference IDs
    const existingEntries = await JournalEntry.find({ companyId: req.companyId }).select('referenceId').lean();
    const existingRefs = new Set(existingEntries.map(e => e.referenceId?.toString()).filter(Boolean));

    let transactionsCreated = 0;
    let cashMovementsCreated = 0;

    // Backfill Transactions
    const transactions = await Transaction.find({ companyId: req.companyId }).lean();
    for (const txn of transactions) {
      if (existingRefs.has(txn._id.toString())) continue;
      try {
        const { createIncomeEntry } = await import('../utils/journalEngine.js');
        await createIncomeEntry(req.companyDb, txn);
        transactionsCreated++;
      } catch (e) {
        console.warn(`[Journal Backfill] Failed for transaction ${txn._id}:`, e.message);
      }
    }

    // Backfill CashMovements
    const cashMovements = await CashMovement.find({ companyId: req.companyId }).lean();
    for (const cm of cashMovements) {
      if (existingRefs.has(cm._id.toString())) continue;
      try {
        const { createCashMovementEntry } = await import('../utils/journalEngine.js');
        await createCashMovementEntry(req.companyDb, cm);
        cashMovementsCreated++;
      } catch (e) {
        console.warn(`[Journal Backfill] Failed for cash movement ${cm._id}:`, e.message);
      }
    }

    return res.json({
      success: true,
      message: `Backfill complete: ${transactionsCreated} transactions, ${cashMovementsCreated} cash movements processed`,
      transactionsCreated,
      cashMovementsCreated,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
