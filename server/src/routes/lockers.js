import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

console.log('[Lockers Router] Router initialized, defining routes...');

// ============================================
// LOCKER SETTINGS ENDPOINTS
// ============================================

// Get locker settings
router.get('/settings', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const LockerSettings = getCompanyModel(req.companyDb, 'LockerSettings');
    const settings = await LockerSettings.findOne({ companyId: req.companyId });

    if (!settings) {
      // Return default settings if none exist
      return res.status(200).json({
        settings: {
          companyId: req.companyId,
          totalLockers: 0,
          lockerPrefix: 'Locker',
          pricingMode: 'Free',
          chargeAmount: 0,
          autoNumbering: true,
        },
      });
    }

    return res.status(200).json({ settings });
  } catch (error) {
    console.error('[Lockers] Error fetching settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch locker settings',
      error: error.message,
    });
  }
});

// Save or update locker settings
router.post('/settings', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { totalLockers, lockerPrefix, pricingMode, chargeAmount, autoNumbering } = req.body;
    const LockerSettings = getCompanyModel(req.companyDb, 'LockerSettings');
    const Locker = getCompanyModel(req.companyDb, 'Locker');

    // Find existing settings
    let settings = await LockerSettings.findOne({ companyId: req.companyId });
    const oldTotalLockers = settings ? settings.totalLockers : 0;

    if (!settings) {
      // Create new settings
      settings = new LockerSettings({
        companyId: req.companyId,
        totalLockers,
        lockerPrefix,
        pricingMode,
        chargeAmount,
        autoNumbering,
      });
    } else {
      // Update existing settings
      settings.totalLockers = totalLockers;
      settings.lockerPrefix = lockerPrefix;
      settings.pricingMode = pricingMode;
      settings.chargeAmount = chargeAmount;
      settings.autoNumbering = autoNumbering;
    }

    await settings.save();

    // Auto-create or delete lockers based on totalLockers change
    if (autoNumbering && totalLockers !== oldTotalLockers) {
      if (totalLockers > oldTotalLockers) {
        // Create new lockers
        const newLockers = [];
        for (let i = oldTotalLockers + 1; i <= totalLockers; i++) {
          const lockerNumber = `${lockerPrefix} ${String(i).padStart(2, '0')}`;
          newLockers.push({
            companyId: req.companyId,
            lockerNumber,
            status: 'Available',
          });
        }
        await Locker.insertMany(newLockers);
        console.log(`[Lockers] Created ${newLockers.length} new lockers`);
      } else if (totalLockers < oldTotalLockers) {
        // Mark extra lockers as disabled
        for (let i = totalLockers + 1; i <= oldTotalLockers; i++) {
          const lockerNumber = `${lockerPrefix} ${String(i).padStart(2, '0')}`;
          await Locker.updateOne(
            { companyId: req.companyId, lockerNumber },
            { status: 'Disabled' }
          );
        }
        console.log(`[Lockers] Disabled ${oldTotalLockers - totalLockers} lockers`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Locker settings saved successfully',
      settings,
    });
  } catch (error) {
    console.error('[Lockers] Error saving settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save locker settings',
      error: error.message,
    });
  }
});

// ============================================
// LOCKER LIST & STATS ENDPOINTS
// ============================================

// Get all lockers with optional filters
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { status, search } = req.query;
    const Locker = getCompanyModel(req.companyDb, 'Locker');
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');

    const filter = { companyId: req.companyId };
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.lockerNumber = { $regex: search, $options: 'i' };
    }

    let lockers = await Locker.find(filter).lean();

    // Enhance each locker with active assignment info and payment status
    lockers = await Promise.all(
      lockers.map(async (locker) => {
        const assignment = await LockerAssignment.findOne({
          lockerId: locker._id,
          status: 'Active',
        }).lean();

        let paymentStatus = 'None';
        if (assignment) {
          if (assignment.chargeAmount > 0 && assignment.chargeType === 'SeparateTransaction' && assignment.transactionId) {
            const transaction = await Transaction.findOne({
              _id: assignment.transactionId,
              companyId: req.companyId,
            }).lean();
            if (transaction) {
              paymentStatus = transaction.paymentMethod === 'Due' ? 'Due' : 'Paid';
            } else {
              paymentStatus = 'Due';
            }
          } else if (assignment.chargeAmount > 0 && assignment.chargeType === 'AttachedToExistingBill' && assignment.existingBillTransactionId) {
            const parentBill = await Transaction.findOne({
              _id: assignment.existingBillTransactionId,
              companyId: req.companyId,
            }).lean();
            if (parentBill) {
              const due = parentBill.dueAmount || (parentBill.amount - (parentBill.amountPaid || 0));
              paymentStatus = due > 0 ? 'Due' : 'Paid';
            }
          } else if (assignment.isBillPayer && assignment.billPayerTransactionId) {
            const session = await HourlySession.findOne({
              _id: assignment.billPayerTransactionId,
              companyId: req.companyId,
            }).lean();
            if (session) {
              if (session.transactionId) {
                const txn = await Transaction.findOne({
                  _id: session.transactionId,
                  companyId: req.companyId,
                }).lean();
                paymentStatus = txn && txn.paymentMethod !== 'Due' ? 'Paid' : 'Due';
              } else {
                paymentStatus = 'Due';
              }
            } else {
              paymentStatus = 'Due';
            }
          } else if (assignment.chargeAmount === 0 || assignment.chargeType === 'None') {
            paymentStatus = 'Free';
          } else if (assignment.chargeAmount > 0) {
            paymentStatus = 'Due';
          }
        }

        return {
          ...locker,
          status: assignment ? 'Occupied' : locker.status,
          assignment: assignment ? { ...assignment, paymentStatus } : null,
        };
      })
    );

    return res.status(200).json({ lockers });
  } catch (error) {
    console.error('[Lockers] Error fetching lockers:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lockers',
      error: error.message,
    });
  }
});

// Get locker statistics for dashboard
router.get('/stats', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const Locker = getCompanyModel(req.companyDb, 'Locker');
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count totals
    const totalLockers = await Locker.countDocuments({
      companyId: req.companyId,
      status: { $ne: 'Disabled' },
    });

    const availableLockers = await Locker.countDocuments({
      companyId: req.companyId,
      status: 'Available',
    });

    const occupiedLockers = await Locker.countDocuments({
      companyId: req.companyId,
      status: 'Occupied',
    });

    const activeSessions = await LockerAssignment.countDocuments({
      companyId: req.companyId,
      status: 'Active',
    });

    // Calculate revenue today
    const todayRevenue = await Transaction.aggregate([
      {
        $match: {
          companyId: req.companyId,
          serviceType: 'Locker',
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const revenueToday = todayRevenue.length > 0 ? todayRevenue[0].total : 0;

    return res.status(200).json({
      stats: {
        totalLockers,
        availableLockers,
        occupiedLockers,
        activeSessions,
        revenueToday,
      },
    });
  } catch (error) {
    console.error('[Lockers] Error fetching stats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch locker statistics',
      error: error.message,
    });
  }
});

// ============================================
// LOCKER ASSIGNMENT ENDPOINTS
// ============================================

console.log('[Lockers Router] Defining LOCKER ASSIGNMENT endpoints...');

// Get locker assignments by bill/transaction ID (for displaying lockers in bills table)
router.get('/assignments-by-bill/:billId', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { billId } = req.params;
    console.log('[Lockers] GET /assignments-by-bill/:billId called with billId:', billId, 'companyId:', req.companyId);
    
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');

    // Find active locker assignments for this bill/transaction
    const assignments = await LockerAssignment.find({
      companyId: req.companyId,
      billPayerTransactionId: billId,
      status: 'Active',
    })
      .populate('lockerId', 'lockerNumber status')
      .lean();

    console.log('[Lockers] Found', assignments.length, 'locker assignments');

    // Format response with locker numbers and payment info
    const lockerAssignments = await Promise.all(assignments.map(async (assignment) => {
      // Compute payment status (same logic as GET / endpoint)
      let paymentStatus = 'Free';
      if (assignment.chargeAmount > 0 && assignment.chargeType === 'SeparateTransaction' && assignment.transactionId) {
        const transaction = await Transaction.findOne({
          _id: assignment.transactionId,
          companyId: req.companyId,
        }).lean();
        if (transaction) {
          paymentStatus = transaction.paymentMethod === 'Due' ? 'Due' : 'Paid';
        } else {
          paymentStatus = 'Due';
        }
      } else if (assignment.chargeAmount > 0 && assignment.chargeType === 'AttachedToExistingBill' && assignment.existingBillTransactionId) {
        const parentBill = await Transaction.findOne({
          _id: assignment.existingBillTransactionId,
          companyId: req.companyId,
        }).lean();
        if (parentBill) {
          const due = parentBill.dueAmount || (parentBill.amount - (parentBill.amountPaid || 0));
          paymentStatus = due > 0 ? 'Due' : 'Paid';
        }
      } else if (assignment.isBillPayer && assignment.billPayerTransactionId) {
        const session = await HourlySession.findOne({
          _id: assignment.billPayerTransactionId,
          companyId: req.companyId,
        }).lean();
        if (session) {
          if (session.transactionId) {
            const txn = await Transaction.findOne({
              _id: session.transactionId,
              companyId: req.companyId,
            }).lean();
            paymentStatus = txn && txn.paymentMethod !== 'Due' ? 'Paid' : 'Due';
          } else {
            paymentStatus = 'Due';
          }
        } else {
          paymentStatus = 'Due';
        }
      } else if (assignment.chargeAmount === 0 || assignment.chargeType === 'None') {
        paymentStatus = 'Free';
      } else if (assignment.chargeAmount > 0) {
        paymentStatus = 'Due';
      }

      return {
        _id: assignment._id,
        lockerId: assignment.lockerId?._id,
        lockerNumber: assignment.lockerId?.lockerNumber || 'Unknown',
        status: assignment.status,
        assignedTime: assignment.assignedTime,
        chargeType: assignment.chargeType,
        chargeAmount: assignment.chargeAmount || 0,
        paymentStatus,
        transactionId: assignment.transactionId || null,
      };
    }));

    return res.status(200).json({
      success: true,
      lockerAssignments,
    });
  } catch (error) {
    console.error('[Lockers] Error fetching locker assignments by bill:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch locker assignments',
      error: error.message,
    });
  }
});

// Assign locker to member
router.post('/:lockerId/assign', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { lockerId } = req.params;
    const { memberId, memberName, memberPhone, memberType, chargeType, chargeAmount, existingBillTransactionId, notes } = req.body;

    const Locker = getCompanyModel(req.companyDb, 'Locker');
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    // Validate locker exists and is available
    const locker = await Locker.findOne({
      _id: lockerId,
      companyId: req.companyId,
    });

    if (!locker) {
      return res.status(404).json({
        success: false,
        message: 'Locker not found',
      });
    }

    if (locker.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: `Locker is ${locker.status} and cannot be assigned`,
      });
    }

    // Check if locker is already assigned (extra safety)
    const existingAssignment = await LockerAssignment.findOne({
      lockerId,
      status: 'Active',
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Locker is already assigned to another member',
      });
    }

    // Create assignment
    const isBillPayer = req.body.isBillPayer || false;
    const assignment = new LockerAssignment({
      companyId: req.companyId,
      lockerId,
      memberId,
      memberType,
      memberName,
      memberPhone,
      assignedTime: new Date(),
      status: 'Active',
      chargeType,
      chargeAmount: chargeAmount || 0,
      assignedByAdmin: req.user?.name || 'System',
      notes,
      isBillPayer,
      billPayerTransactionId: isBillPayer ? existingBillTransactionId : null,
    });

    // Handle billing
    let transactionCreated = null;
    if (chargeType === 'SeparateTransaction' && chargeAmount > 0) {
      const transaction = new Transaction({
        companyId: req.companyId,
        name: memberName,
        phone: memberPhone,
        serviceType: 'Locker',
        amount: chargeAmount,
        paymentMethod: 'Due',
        receiptId: `L-${Date.now()}`,
        date: new Date(),
        price: chargeAmount,
        lockerAssignmentId: assignment._id,
      });
      await transaction.save();
      try {
        const { createIncomeEntry } = await import('../utils/journalEngine.js');
        await createIncomeEntry(req.companyDb, transaction);
      } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }
      assignment.transactionId = transaction._id;
      transactionCreated = transaction;
      console.log(`[Lockers] Created locker transaction: ${transaction._id}`);
    } else if (chargeType === 'AttachedToExistingBill' && chargeAmount > 0 && existingBillTransactionId) {
      // Update existing bill transaction
      const existingBill = await Transaction.findOne({
        _id: existingBillTransactionId,
        companyId: req.companyId,
      });

      if (existingBill) {
        existingBill.amount = (existingBill.amount || 0) + chargeAmount;
        // Update dueAmount to reflect the added charge
        const currentDue = existingBill.dueAmount || (existingBill.amount - (existingBill.amountPaid || 0));
        existingBill.dueAmount = currentDue + chargeAmount;
        await existingBill.save();
        assignment.existingBillTransactionId = existingBillTransactionId;
        console.log(`[Lockers] Updated existing bill with locker charge`);
      }
    }

    // Save assignment and update locker status
    await assignment.save();
    locker.status = 'Occupied';
    await locker.save();

    console.log(`[Lockers] Locker ${locker.lockerNumber} assigned to ${memberName}`);

    return res.status(201).json({
      success: true,
      message: 'Locker assigned successfully',
      assignment,
      transaction: transactionCreated,
    });
  } catch (error) {
    console.error('[Lockers] Error assigning locker:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign locker',
      error: error.message,
    });
  }
});

// Return locker (release key)
router.post('/:lockerId/return', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { lockerId } = req.params;

    const Locker = getCompanyModel(req.companyDb, 'Locker');
    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');

    // Find locker
    const locker = await Locker.findOne({
      _id: lockerId,
      companyId: req.companyId,
    });

    if (!locker) {
      return res.status(404).json({
        success: false,
        message: 'Locker not found',
      });
    }

    // Find active assignment
    const assignment = await LockerAssignment.findOne({
      lockerId,
      status: 'Active',
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'No active assignment found for this locker',
      });
    }

    // Update assignment
    assignment.returnedTime = new Date();
    assignment.status = 'Returned';
    await assignment.save();

    // Update locker status
    locker.status = 'Available';
    await locker.save();

    console.log(`[Lockers] Locker ${locker.lockerNumber} returned by ${assignment.memberName}`);

    return res.status(200).json({
      success: true,
      message: 'Locker returned successfully',
      assignment,
    });
  } catch (error) {
    console.error('[Lockers] Error returning locker:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to return locker',
      error: error.message,
    });
  }
});

// Update locker status (Maintenance/Disabled)
router.put('/:lockerId/status', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { lockerId } = req.params;
    const { status } = req.body;

    if (!['Available', 'Maintenance', 'Disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const Locker = getCompanyModel(req.companyDb, 'Locker');
    const locker = await Locker.findOneAndUpdate(
      { _id: lockerId, companyId: req.companyId },
      { status },
      { new: true }
    );

    if (!locker) {
      return res.status(404).json({
        success: false,
        message: 'Locker not found',
      });
    }

    console.log(`[Lockers] Locker ${locker.lockerNumber} status updated to ${status}`);

    return res.status(200).json({
      success: true,
      message: 'Locker status updated',
      locker,
    });
  } catch (error) {
    console.error('[Lockers] Error updating locker status:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update locker status',
      error: error.message,
    });
  }
});

// ============================================
// LOCKER HISTORY ENDPOINTS
// ============================================

// Get history for specific locker
router.get('/:lockerId/history', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { lockerId } = req.params;
    const { startDate, endDate } = req.query;

    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');

    const filter = {
      lockerId,
      companyId: req.companyId,
      status: 'Returned',
    };

    if (startDate || endDate) {
      filter.returnedTime = {};
      if (startDate) {
        filter.returnedTime.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.returnedTime.$lte = end;
      }
    }

    const history = await LockerAssignment.find(filter)
      .sort({ returnedTime: -1 })
      .lean();

    return res.status(200).json({ history });
  } catch (error) {
    console.error('[Lockers] Error fetching locker history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch locker history',
      error: error.message,
    });
  }
});

// Get history for specific member
router.get('/member/:memberId/history', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate } = req.query;

    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');

    const filter = {
      memberId,
      companyId: req.companyId,
      status: 'Returned',
    };

    if (startDate || endDate) {
      filter.returnedTime = {};
      if (startDate) {
        filter.returnedTime.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.returnedTime.$lte = end;
      }
    }

    const history = await LockerAssignment.find(filter)
      .sort({ returnedTime: -1 })
      .lean();

    return res.status(200).json({ history });
  } catch (error) {
    console.error('[Lockers] Error fetching member locker history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch member locker history',
      error: error.message,
    });
  }
});

// Get active assignments for a member
router.get('/member/:memberId/active', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { memberId } = req.params;

    const LockerAssignment = getCompanyModel(req.companyDb, 'LockerAssignment');

    const activeAssignments = await LockerAssignment.find({
      memberId,
      companyId: req.companyId,
      status: 'Active',
    }).lean();

    return res.status(200).json({ activeAssignments });
  } catch (error) {
    console.error('[Lockers] Error fetching active assignments:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active assignments',
      error: error.message,
    });
  }
});

// ============================================
// ============================================
// BILL PAYER ENDPOINTS
// ============================================

// Get active hourly swimmers (for locker assignment from Hourly Sessions section) - MUST come before /by-bill/:billId
router.get('/bill-payers/list', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');

    // Find all active hourly sessions
    const activeSessions = await HourlySession.find({
      companyId: req.companyId,
      status: 'active'
    }).select('customerName phone _id startTime totalAmount').lean();

    // Format and return hourly swimmers
    const hourlySwimmers = activeSessions.map(session => ({
      name: session.customerName,
      phone: session.phone || '',
      sessionId: session._id,
      startTime: session.startTime,
      totalAmount: session.totalAmount || 0
    }));

    return res.status(200).json({ billPayers: hourlySwimmers });
  } catch (error) {
    console.error('[Lockers] Error fetching active hourly swimmers:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active hourly swimmers',
      error: error.message,
    });
  }
});

// Process payment for a locker transaction
router.post('/payment/:transactionId', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    const transaction = await Transaction.findOne({
      _id: transactionId,
      companyId: req.companyId,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Update transaction payment details
    transaction.amountPaid = (transaction.amountPaid || 0) + amount;
    transaction.dueAmount = Math.max(0, (transaction.amount || 0) - transaction.amountPaid);
    transaction.paymentMethod = paymentMethod;
    if (notes) {
      transaction.notes = notes;
    }
    await transaction.save();

    console.log(`[Lockers] Payment recorded for transaction ${transactionId}: ${amount} via ${paymentMethod}`);

    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      transaction,
    });
  } catch (error) {
    console.error('[Lockers] Error processing payment:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message,
    });
  }
});

export default router;
