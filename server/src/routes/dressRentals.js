import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

console.log('[Dress Rentals Router] Router initialized, defining routes...');

// ============================================
// DRESS RENTAL SETTINGS ENDPOINTS
// ============================================

// Get dress rental settings
router.get('/settings', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const DressRentalSettings = getCompanyModel(req.companyDb, 'DressRentalSettings');
    const settings = await DressRentalSettings.findOne({ companyId: req.companyId });

    if (!settings) {
      return res.status(200).json({
        settings: {
          companyId: req.companyId,
          dressTypes: [],
          prefix: 'Dress',
          autoNumbering: true,
        },
      });
    }

    return res.status(200).json({ settings });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dress rental settings',
      error: error.message,
    });
  }
});

// Save or update dress rental settings + auto-create Dress records
router.post('/settings', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { dressTypes, prefix, autoNumbering } = req.body;
    const DressRentalSettings = getCompanyModel(req.companyDb, 'DressRentalSettings');
    const Dress = getCompanyModel(req.companyDb, 'Dress');

    let settings = await DressRentalSettings.findOne({ companyId: req.companyId });

    if (!settings) {
      settings = new DressRentalSettings({
        companyId: req.companyId,
        dressTypes,
        prefix,
        autoNumbering,
      });
    } else {
      settings.dressTypes = dressTypes;
      settings.prefix = prefix;
      settings.autoNumbering = autoNumbering;
    }

    await settings.save();

    // Auto-create Dress records for each dress type based on count
    if (autoNumbering && dressTypes && dressTypes.length > 0) {
      for (const dressType of dressTypes) {
        const count = dressType.count || 0;
        const existingDresses = await Dress.find({
          companyId: req.companyId,
          type: dressType.name,
        }).lean();

        const existingCount = existingDresses.length;

        if (count > existingCount) {
          // Create new dresses for this type
          const newDresses = [];
          for (let i = existingCount + 1; i <= count; i++) {
            const dressNumber = `${prefix || 'Dress'} ${dressType.name} ${String(i).padStart(2, '0')}`;
            newDresses.push({
              companyId: req.companyId,
              dressNumber,
              type: dressType.name,
              chargeAmount: dressType.chargeAmount || 0,
              status: 'Available',
            });
          }
          await Dress.insertMany(newDresses);
          console.log(`[Dress Rentals] Created ${newDresses.length} new dresses of type "${dressType.name}"`);
        } else if (count < existingCount) {
          // Disable extra dresses of this type
          const toDisable = existingDresses.slice(count);
          for (const d of toDisable) {
            await Dress.updateOne(
              { _id: d._id, companyId: req.companyId },
              { status: 'Disabled' }
            );
          }
          console.log(`[Dress Rentals] Disabled ${toDisable.length} dresses of type "${dressType.name}"`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Dress rental settings saved successfully',
      settings,
    });
  } catch (error) {
    console.error('[Dress Rentals] Error saving settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save dress rental settings',
      error: error.message,
    });
  }
});

// ============================================
// DRESS LIST & STATS ENDPOINTS
// ============================================

// Get all dresses with optional filters
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { status, search, type } = req.query;
    const Dress = getCompanyModel(req.companyDb, 'Dress');
    const DressRental = getCompanyModel(req.companyDb, 'DressRental');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    const filter = { companyId: req.companyId };
    if (status) {
      filter.status = status;
    }
    if (type) {
      filter.type = type;
    }
    if (search) {
      filter.dressNumber = { $regex: search, $options: 'i' };
    }

    let dresses = await Dress.find(filter).lean();

    // Enhance each dress with active rental info and payment status
    dresses = await Promise.all(
      dresses.map(async (dress) => {
        const rental = await DressRental.findOne({
          dressId: dress._id,
          status: 'Active',
        }).lean();

        let paymentStatus = 'None';
        if (rental) {
          if (rental.chargeAmount > 0 && rental.chargeType === 'SeparateTransaction' && rental.transactionId) {
            const transaction = await Transaction.findOne({
              _id: rental.transactionId,
              companyId: req.companyId,
            }).lean();
            if (transaction) {
              paymentStatus = transaction.paymentMethod === 'Due' ? 'Due' : 'Paid';
            } else {
              paymentStatus = 'Due';
            }
          } else if (rental.chargeAmount > 0 && rental.chargeType === 'AttachedToExistingBill' && rental.existingBillTransactionId) {
            const parentBill = await Transaction.findOne({
              _id: rental.existingBillTransactionId,
              companyId: req.companyId,
            }).lean();
            if (parentBill) {
              const due = parentBill.dueAmount || (parentBill.amount - (parentBill.amountPaid || 0));
              paymentStatus = due > 0 ? 'Due' : 'Paid';
            }
          } else if (rental.chargeAmount === 0 || rental.chargeType === 'None') {
            paymentStatus = 'Free';
          } else if (rental.chargeAmount > 0) {
            paymentStatus = 'Due';
          }
        }

        return {
          ...dress,
          status: rental ? 'Rented' : dress.status,
          rental: rental ? { ...rental, paymentStatus } : null,
        };
      })
    );

    return res.status(200).json({ dresses });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching dresses:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dresses',
      error: error.message,
    });
  }
});

// Get dress rental statistics for dashboard
router.get('/stats', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const Dress = getCompanyModel(req.companyDb, 'Dress');
    const DressRental = getCompanyModel(req.companyDb, 'DressRental');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalDresses = await Dress.countDocuments({
      companyId: req.companyId,
      status: { $ne: 'Disabled' },
    });

    const availableDresses = await Dress.countDocuments({
      companyId: req.companyId,
      status: 'Available',
    });

    const rentedDresses = await Dress.countDocuments({
      companyId: req.companyId,
      status: 'Rented',
    });

    const activeRentals = await DressRental.countDocuments({
      companyId: req.companyId,
      status: 'Active',
    });

    // Calculate revenue today
    const todayRevenue = await Transaction.aggregate([
      {
        $match: {
          companyId: req.companyId,
          serviceType: 'Dress Rental',
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
        totalDresses,
        availableDresses,
        rentedDresses,
        activeRentals,
        revenueToday,
      },
    });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching stats:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dress rental statistics',
      error: error.message,
    });
  }
});

// ============================================
// DRESS RENTAL ASSIGNMENT ENDPOINTS
// ============================================

// Get dress rental assignments by bill/transaction ID
router.get('/assignments-by-bill/:billId', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { billId } = req.params;
    console.log('[Dress Rentals] GET /assignments-by-bill/:billId called with billId:', billId, 'companyId:', req.companyId);

    const DressRental = getCompanyModel(req.companyDb, 'DressRental');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    const rentals = await DressRental.find({
      companyId: req.companyId,
      existingBillTransactionId: billId,
      status: 'Active',
    })
      .populate('dressId', 'dressNumber type status')
      .lean();

    console.log('[Dress Rentals] Found', rentals.length, 'dress rentals');

    const dressRentals = await Promise.all(rentals.map(async (rental) => {
      let paymentStatus = 'Free';
      if (rental.chargeAmount > 0 && rental.chargeType === 'SeparateTransaction' && rental.transactionId) {
        const transaction = await Transaction.findOne({
          _id: rental.transactionId,
          companyId: req.companyId,
        }).lean();
        if (transaction) {
          paymentStatus = transaction.paymentMethod === 'Due' ? 'Due' : 'Paid';
        } else {
          paymentStatus = 'Due';
        }
      } else if (rental.chargeAmount > 0 && rental.chargeType === 'AttachedToExistingBill' && rental.existingBillTransactionId) {
        const parentBill = await Transaction.findOne({
          _id: rental.existingBillTransactionId,
          companyId: req.companyId,
        }).lean();
        if (parentBill) {
          const due = parentBill.dueAmount || (parentBill.amount - (parentBill.amountPaid || 0));
          paymentStatus = due > 0 ? 'Due' : 'Paid';
        }
      } else if (rental.chargeAmount === 0 || rental.chargeType === 'None') {
        paymentStatus = 'Free';
      } else if (rental.chargeAmount > 0) {
        paymentStatus = 'Due';
      }

      return {
        _id: rental._id,
        dressId: rental.dressId?._id,
        dressNumber: rental.dressId?.dressNumber || 'Unknown',
        dressType: rental.dressId?.type || 'Unknown',
        status: rental.status,
        assignedTime: rental.assignedTime,
        chargeType: rental.chargeType,
        chargeAmount: rental.chargeAmount || 0,
        paymentStatus,
        transactionId: rental.transactionId || null,
      };
    }));

    return res.status(200).json({
      success: true,
      dressRentals,
    });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching dress rentals by bill:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dress rentals',
      error: error.message,
    });
  }
});

// Assign dress to member
router.post('/:dressId/assign', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { dressId } = req.params;
    const { memberId, memberName, memberPhone, memberType, chargeType, chargeAmount, existingBillTransactionId, notes, isBillPayer } = req.body;

    const Dress = getCompanyModel(req.companyDb, 'Dress');
    const DressRental = getCompanyModel(req.companyDb, 'DressRental');
    const Transaction = getCompanyModel(req.companyDb, 'Transaction');

    // Validate dress exists and is available
    const dress = await Dress.findOne({
      _id: dressId,
      companyId: req.companyId,
    });

    if (!dress) {
      return res.status(404).json({
        success: false,
        message: 'Dress not found',
      });
    }

    if (dress.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: `Dress is ${dress.status} and cannot be assigned`,
      });
    }

    // Check if dress is already rented (extra safety)
    const existingRental = await DressRental.findOne({
      dressId,
      status: 'Active',
    });

    if (existingRental) {
      return res.status(400).json({
        success: false,
        message: 'Dress is already rented to another member',
      });
    }

    // Create rental assignment
    const rental = new DressRental({
      companyId: req.companyId,
      dressId,
      memberId,
      memberType: isBillPayer ? 'BillPayer' : memberType,
      memberName,
      memberPhone,
      assignedTime: new Date(),
      status: 'Active',
      chargeType,
      chargeAmount: chargeAmount || 0,
      assignedByAdmin: req.user?.name || 'System',
      notes,
      billPayerTransactionId: isBillPayer ? memberId : null,
    });

    // Handle billing
    let transactionCreated = null;
    if (chargeType === 'SeparateTransaction' && chargeAmount > 0) {
      const transaction = new Transaction({
        companyId: req.companyId,
        name: memberName,
        phone: memberPhone,
        serviceType: 'Dress Rental',
        amount: chargeAmount,
        paymentMethod: 'Due',
        receiptId: `DR-${Date.now()}`,
        date: new Date(),
        price: chargeAmount,
        dressRentalId: rental._id,
      });
      await transaction.save();
      try {
        const { createIncomeEntry } = await import('../utils/journalEngine.js');
        await createIncomeEntry(req.companyDb, transaction);
      } catch (je) { console.warn('[Journal] Failed to create income entry:', je.message); }
      rental.transactionId = transaction._id;
      transactionCreated = transaction;
      console.log(`[Dress Rentals] Created dress rental transaction: ${transaction._id}`);
    } else if (chargeType === 'AttachedToExistingBill' && chargeAmount > 0 && existingBillTransactionId) {
      const existingBill = await Transaction.findOne({
        _id: existingBillTransactionId,
        companyId: req.companyId,
      });

      if (existingBill) {
        existingBill.amount = (existingBill.amount || 0) + chargeAmount;
        const currentDue = existingBill.dueAmount || (existingBill.amount - (existingBill.amountPaid || 0));
        existingBill.dueAmount = currentDue + chargeAmount;
        await existingBill.save();
        rental.existingBillTransactionId = existingBillTransactionId;
        console.log(`[Dress Rentals] Updated existing bill with dress rental charge`);
      }
    }

    // Save rental and update dress status
    await rental.save();
    dress.status = 'Rented';
    await dress.save();

    console.log(`[Dress Rentals] Dress ${dress.dressNumber} assigned to ${memberName}`);

    return res.status(201).json({
      success: true,
      message: 'Dress assigned successfully',
      rental,
      transaction: transactionCreated,
    });
  } catch (error) {
    console.error('[Dress Rentals] Error assigning dress:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign dress',
      error: error.message,
    });
  }
});

// Return dress
router.post('/:dressId/return', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { dressId } = req.params;

    const Dress = getCompanyModel(req.companyDb, 'Dress');
    const DressRental = getCompanyModel(req.companyDb, 'DressRental');

    const dress = await Dress.findOne({
      _id: dressId,
      companyId: req.companyId,
    });

    if (!dress) {
      return res.status(404).json({
        success: false,
        message: 'Dress not found',
      });
    }

    // Find active rental
    const rental = await DressRental.findOne({
      dressId,
      status: 'Active',
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'No active rental found for this dress',
      });
    }

    // Update rental
    rental.returnedTime = new Date();
    rental.status = 'Returned';
    await rental.save();

    // Update dress status
    dress.status = 'Available';
    await dress.save();

    console.log(`[Dress Rentals] Dress ${dress.dressNumber} returned by ${rental.memberName}`);

    return res.status(200).json({
      success: true,
      message: 'Dress returned successfully',
      rental,
    });
  } catch (error) {
    console.error('[Dress Rentals] Error returning dress:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to return dress',
      error: error.message,
    });
  }
});

// ============================================
// DRESS RENTAL HISTORY ENDPOINTS
// ============================================

// Get history for specific dress
router.get('/:dressId/history', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { dressId } = req.params;
    const { startDate, endDate } = req.query;

    const DressRental = getCompanyModel(req.companyDb, 'DressRental');

    const filter = {
      dressId,
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

    const history = await DressRental.find(filter)
      .sort({ returnedTime: -1 })
      .lean();

    return res.status(200).json({ history });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching dress history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dress history',
      error: error.message,
    });
  }
});

// Get history for specific member
router.get('/member/:memberId/history', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate } = req.query;

    const DressRental = getCompanyModel(req.companyDb, 'DressRental');

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

    const history = await DressRental.find(filter)
      .sort({ returnedTime: -1 })
      .lean();

    return res.status(200).json({ history });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching member dress rental history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch member dress rental history',
      error: error.message,
    });
  }
});

// Get active rentals for a member
router.get('/member/:memberId/active', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { memberId } = req.params;

    const DressRental = getCompanyModel(req.companyDb, 'DressRental');

    const activeRentals = await DressRental.find({
      memberId,
      companyId: req.companyId,
      status: 'Active',
    }).lean();

    return res.status(200).json({ activeRentals });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching active rentals:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active rentals',
      error: error.message,
    });
  }
});

// ============================================
// PAYMENT ENDPOINT
// ============================================

// Process payment for a dress rental transaction
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

    console.log(`[Dress Rentals] Payment recorded for transaction ${transactionId}: ${amount} via ${paymentMethod}`);

    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      transaction,
    });
  } catch (error) {
    console.error('[Dress Rentals] Error processing payment:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message,
    });
  }
});

// ============================================
// BILL PAYER ENDPOINTS
// ============================================

// Get active hourly swimmers (for dress rental assignment)
router.get('/bill-payers/list', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const HourlySession = getCompanyModel(req.companyDb, 'HourlySession');

    const activeSessions = await HourlySession.find({
      companyId: req.companyId,
      status: 'active'
    }).select('customerName phone _id startTime totalAmount').lean();

    const hourlySwimmers = activeSessions.map(session => ({
      name: session.customerName,
      phone: session.phone || '',
      sessionId: session._id,
      startTime: session.startTime,
      totalAmount: session.totalAmount || 0
    }));

    return res.status(200).json({ billPayers: hourlySwimmers });
  } catch (error) {
    console.error('[Dress Rentals] Error fetching active hourly swimmers:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active hourly swimmers',
      error: error.message,
    });
  }
});

console.log('[Dress Rentals Router] All routes defined. Router ready to use.');

export default router;
