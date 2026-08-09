import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * Health check endpoint - reports system DB connectivity only.
 * GET /api/diagnostic/health
 * Intentionally public (used by uptime monitors) - keep the response minimal,
 * no user counts or environment details for unauthenticated callers.
 */
router.get('/health', async (req, res) => {
  const systemDbConnected = mongoose.connection.readyState === 1;
  if (!systemDbConnected) {
    return res.status(503).json({ status: 'UNHEALTHY' });
  }
  return res.json({ status: 'HEALTHY' });
});

/**
 * Detailed DB check endpoint - tests both system and company DB connectivity
 * GET /api/diagnostic/db-check
 * Requires authentication
 */
router.get('/db-check', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        email: req.user.email,
        companyId: req.companyId.toString(),
      },
      systemDb: {
        connected: mongoose.connection.readyState === 1,
        message: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      },
      companyDb: {
        connected: false,
        testWrite: false,
      },
    };

    // Test system DB access
    try {
      const userRecord = await User.findById(req.user.id);
      if (userRecord) {
        results.systemDb.companyRecord = await Company.findById(req.companyId);
      }
    } catch (err) {
      results.systemDb.error = err.message;
    }

    // Test company DB connection
    if (results.systemDb.companyRecord) {
      try {
        const companyDb = req.companyDb;

        // Try to access company DB collections
        const collections = await companyDb.db.listCollections().toArray();
        results.companyDb.connected = true;
        results.companyDb.collections = collections.map(c => c.name);

        // Test creating a temporary document (without saving)
        // This validates schema validation without polluting the DB
        try {
          const Student = getCompanyModel(companyDb, 'Student');
          const testDoc = new Student({
            companyId: req.companyId,
            name: 'Test',
            phone: 'test',
            ageGroup: '4-8',
            batchType: 'Basic',
            timeSlot: 'Morning',
            classSlot: 1,
            totalClasses: 10,
            remainingClasses: 10,
            price: 0,
            discount: 0,
            durationDays: 1,
            startDate: new Date(),
            endDate: new Date(),
            amountPaid: 0,
            due: 0,
          });

          // Validate without saving
          await testDoc.validate();
          results.companyDb.schemaValidation = 'PASSED';
        } catch (err) {
          results.companyDb.schemaValidation = err.message;
        }
      } catch (err) {
        results.companyDb.error = err.message;
      }
    }

    // Determine overall health
    results.overall = {
      healthy: results.systemDb.connected && results.companyDb.connected,
      message: results.systemDb.connected && results.companyDb.connected
        ? 'Both databases are healthy'
        : 'One or more databases have issues',
    };

    const statusCode = results.overall.healthy ? 200 : 503;
    return res.status(statusCode).json(results);
  } catch (error) {
    console.error('[Diagnostic] db-check failed:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test save operation endpoint - attempts to create and immediately delete a test record
 * POST /api/diagnostic/test-save
 * Requires authentication
 */
router.post('/test-save', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const { modelName = 'Transaction' } = req.body;
    const Model = getCompanyModel(req.companyDb, modelName);

    // Create test document based on model type
    let testData = {
      companyId: req.companyId,
      name: 'Test Record',
    };

    if (modelName === 'Transaction') {
      testData = {
        ...testData,
        phone: '1234567890',
        serviceType: 'Testing',
        amount: 100,
        paymentMethod: 'Cash',
        receiptId: `TEST-${Date.now()}`,
        date: new Date(),
      };
    } else if (modelName === 'Student') {
      testData = {
        ...testData,
        phone: '1234567890',
        ageGroup: '4-8',
        batchType: 'Basic',
        timeSlot: 'Morning',
        classSlot: 1,
        totalClasses: 10,
        remainingClasses: 10,
        price: 1000,
        discount: 0,
        durationDays: 1,
        startDate: new Date(),
        endDate: new Date(),
        amountPaid: 1000,
        due: 0,
      };
    }

    const testRecord = new Model(testData);
    await testRecord.save();
    await Model.deleteOne({ _id: testRecord._id });

    return res.json({
      success: true,
      message: `Successfully saved and deleted test ${modelName}`,
      testId: testRecord._id.toString(),
    });
  } catch (error) {
    console.error('[Diagnostic] test-save failed:', error.message);
    return res.status(500).json({
      success: false,
      message: `Test save failed for model: ${req.body.modelName || 'Transaction'}`,
      error: error.message,
    });
  }
});

export default router;
