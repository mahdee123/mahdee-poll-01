import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyConnection } from '../utils/companyDb.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * Health check endpoint - tests system and company DB connectivity
 * GET /api/diagnostic/health
 */
router.get('/health', async (req, res) => {
  try {
    console.log(`[Diagnostic] Running system health check...`);
    
    // Check system DB connection
    const systemDbConnected = mongoose.connection.readyState === 1;
    console.log(`[Diagnostic] System DB connection status: ${systemDbConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    if (!systemDbConnected) {
      return res.status(503).json({
        success: false,
        status: 'UNHEALTHY',
        message: 'System database is not connected',
        systemDb: { connected: false },
      });
    }
    
    // Try to count users in system DB
    const userCount = await User.countDocuments();
    console.log(`[Diagnostic] ✓ System DB is accessible (${userCount} users)`);
    
    return res.json({
      success: true,
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      systemDb: {
        connected: true,
        usersCount: userCount,
        uri: process.env.SYSTEM_MONGODB_URI ? '***configured***' : 'NOT SET',
      },
    });
  } catch (error) {
    console.error(`[Diagnostic] ✗ ERROR in health check:`, error.message);
    return res.status(503).json({
      success: false,
      status: 'UNHEALTHY',
      error: error.message,
    });
  }
});

/**
 * Detailed DB check endpoint - tests both system and company DB connectivity
 * GET /api/diagnostic/db-check
 * Requires authentication
 */
router.get('/db-check', authRequired, validateCompanyContext, async (req, res) => {
  try {
    console.log(`[Diagnostic] Running detailed DB check for user: ${req.user.email} (Company: ${req.companyId})`);
    
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
      const userRecord = await User.findById(req.user._id);
      if (userRecord) {
        results.systemDb.usersCount = await User.countDocuments();
        results.systemDb.companyRecord = await Company.findById(req.companyId);
        console.log(`[Diagnostic] ✓ System DB accessible`);
      }
    } catch (err) {
      results.systemDb.error = err.message;
      console.error(`[Diagnostic] ✗ System DB access error:`, err.message);
    }

    // Test company DB connection
    if (results.systemDb.companyRecord) {
      try {
        const companyDb = req.companyDb;
        const mongoUri = results.systemDb.companyRecord.mongoUri;
        
        console.log(`[Diagnostic] Testing company DB connection: ${mongoUri}`);
        results.companyDb.mongoUri = mongoUri;

        // Try to access company DB collections
        const collections = await companyDb.db.listCollections().toArray();
        results.companyDb.connected = true;
        results.companyDb.collections = collections.map(c => c.name);
        console.log(`[Diagnostic] ✓ Company DB accessible (${collections.length} collections)`);

        // Test creating a temporary document (without saving)
        // This validates schema validation without polluting the DB
        try {
          const Student = companyDb.model('Student', require('../utils/modelRegistry.js').Student);
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
          console.log(`[Diagnostic] ✓ Company DB schema validation passed`);
        } catch (err) {
          results.companyDb.schemaValidation = err.message;
          console.warn(`[Diagnostic] Schema validation issue:`, err.message);
        }
      } catch (err) {
        results.companyDb.error = err.message;
        console.error(`[Diagnostic] ✗ Company DB error:`, err.message);
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
    console.error(`[Diagnostic] ✗ ERROR in db-check:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
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
    console.log(`[Diagnostic] Testing save operation for model: ${modelName}`);

    const { getCompanyModel } = await import('../utils/modelRegistry.js');
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
    console.log(`[Diagnostic] Attempting to save test ${modelName}...`);
    
    await testRecord.save();
    console.log(`[Diagnostic] ✓ Save successful (ID: ${testRecord._id})`);

    // Immediately delete the test record
    await Model.deleteOne({ _id: testRecord._id });
    console.log(`[Diagnostic] ✓ Test record cleaned up`);

    return res.json({
      success: true,
      message: `Successfully saved and deleted test ${modelName}`,
      testId: testRecord._id.toString(),
    });
  } catch (error) {
    console.error(`[Diagnostic] ✗ ERROR in test-save:`, error.message);
    console.error(`[Diagnostic] Error details:`, error);
    return res.status(500).json({
      success: false,
      message: `Test save failed for model: ${req.body.modelName || 'Transaction'}`,
      error: error.message,
      details: error.errors || null,
    });
  }
});

export default router;
