import { getCompanyConnection } from './companyDb.js';
import { initializeCompanySchemas } from './modelRegistry.js';

/**
 * Initialize a new company database
 * Called when a new company registers
 * @param {string} companyId - Company ID
 * @param {string} mongoUri - MongoDB connection URI for company database
 * @returns {Promise<void>}
 */
export const initializeCompanyDatabase = async (companyId, mongoUri) => {
  try {
    // Get connection to company's database
    const companyDb = await getCompanyConnection(companyId, mongoUri);

    // Initialize all schemas
    initializeCompanySchemas(companyDb);

    // Create indexes for performance
    const Member = companyDb.model('Member');
    const Student = companyDb.model('Student');
    const Package = companyDb.model('Package');
    const Transaction = companyDb.model('Transaction');
    const Expense = companyDb.model('Expense');
    const ClassRecord = companyDb.model('ClassRecord');

    // Create indexes
    await Member.collection.createIndex({ companyId: 1 });
    await Member.collection.createIndex({ status: 1 });
    await Member.collection.createIndex({ createdAt: -1 });

    await Student.collection.createIndex({ companyId: 1 });
    await Student.collection.createIndex({ status: 1 });
    await Student.collection.createIndex({ classSlot: 1 });

    await Package.collection.createIndex({ companyId: 1 });
    await Package.collection.createIndex({ active: 1 });

    await Transaction.collection.createIndex({ companyId: 1 });
    await Transaction.collection.createIndex({ date: -1 });
    await Transaction.collection.createIndex({ receiptId: 1 });

    await Expense.collection.createIndex({ companyId: 1 });
    await Expense.collection.createIndex({ date: -1 });
    await Expense.collection.createIndex({ category: 1 });

    await ClassRecord.collection.createIndex({ companyId: 1 });
    await ClassRecord.collection.createIndex({ student: 1 });

    console.log(`✓ Company database initialized for ${companyId}`);
  } catch (err) {
    throw new Error(`Failed to initialize company database: ${err.message}`);
  }
};
