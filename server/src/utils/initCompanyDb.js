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
    const HourlySession = companyDb.model('HourlySession');
    const ClassRecord = companyDb.model('ClassRecord');
    const CashMovement = companyDb.model('CashMovement');
    const Dress = companyDb.model('Dress');
    const DressRental = companyDb.model('DressRental');

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

    await HourlySession.collection.createIndex({ companyId: 1 });
    await HourlySession.collection.createIndex({ status: 1, startTime: -1 });
    await HourlySession.collection.createIndex({ plannedEndTime: 1 });

    await ClassRecord.collection.createIndex({ companyId: 1 });
    await ClassRecord.collection.createIndex({ student: 1 });

    await CashMovement.collection.createIndex({ companyId: 1 });
    await CashMovement.collection.createIndex({ date: -1 });
    await CashMovement.collection.createIndex({ type: 1 });

    await Dress.collection.createIndex({ companyId: 1 });
    await Dress.collection.createIndex({ dressNumber: 1 });
    await Dress.collection.createIndex({ type: 1 });
    await Dress.collection.createIndex({ status: 1 });

    await DressRental.collection.createIndex({ companyId: 1 });
    await DressRental.collection.createIndex({ dressId: 1, status: 1 });
    await DressRental.collection.createIndex({ memberId: 1 });
    await DressRental.collection.createIndex({ status: 1 });

    // Accounting indexes
    const Account = companyDb.model('Account');
    const JournalEntry = companyDb.model('JournalEntry');
    const AccountBalance = companyDb.model('AccountBalance');
    const DailyExpense = companyDb.model('DailyExpense');

    await Account.collection.createIndex({ companyId: 1 });
    await Account.collection.createIndex({ companyId: 1, code: 1 }, { unique: true });
    await Account.collection.createIndex({ companyId: 1, type: 1 });

    await JournalEntry.collection.createIndex({ companyId: 1, date: 1 });
    await JournalEntry.collection.createIndex({ companyId: 1, referenceType: 1, referenceId: 1 });

    await AccountBalance.collection.createIndex({ companyId: 1, accountCode: 1, period: 1 }, { unique: true });

    await DailyExpense.collection.createIndex({ companyId: 1, date: 1 });

    const ExpenseCategory = companyDb.model('ExpenseCategory');
    await ExpenseCategory.collection.createIndex({ companyId: 1 });
    await ExpenseCategory.collection.createIndex({ companyId: 1, name: 1 }, { unique: true });
    await ExpenseCategory.collection.createIndex({ companyId: 1, isActive: 1, sortOrder: 1 });

    // Seed Chart of Accounts for this company
    const existingAccounts = await Account.countDocuments({ companyId: companyId.toString() });
    if (existingAccounts === 0) {
      const defaultAccounts = [
        { code: '1000', name: 'Cash in Hand', type: 'Asset', description: 'Physical cash on premises' },
        { code: '1010', name: 'Bank Account', type: 'Asset', description: 'Bank account balance' },
        { code: '1020', name: 'bKash Account', type: 'Asset', description: 'bKash mobile wallet' },
        { code: '1030', name: 'Petty Cash', type: 'Asset', description: 'Small cash fund for minor expenses' },
        { code: '1040', name: 'Accounts Receivable', type: 'Asset', description: 'Amounts owed by members/students' },
        { code: '2000', name: 'Accounts Payable', type: 'Liability', description: 'Amounts owed to suppliers' },
        { code: '2010', name: 'Customer Advances', type: 'Liability', description: 'Prepaid membership fees' },
        { code: '3000', name: "Owner's Capital", type: 'Equity', description: 'Owner investment in the business' },
        { code: '3010', name: 'Retained Earnings', type: 'Equity', description: 'Accumulated profits/losses' },
        { code: '4000', name: 'Daily Entry Income', type: 'Revenue', description: 'Pool entry fees' },
        { code: '4010', name: 'Training Income', type: 'Revenue', description: 'Swimming training fees' },
        { code: '4020', name: 'Membership Income', type: 'Revenue', description: 'Membership subscription fees' },
        { code: '4030', name: 'Beverage Income', type: 'Revenue', description: 'Beverage and snack sales' },
        { code: '4040', name: 'Hourly Session Income', type: 'Revenue', description: 'Hourly pool session fees' },
        { code: '4050', name: 'Locker Income', type: 'Revenue', description: 'Locker rental charges' },
        { code: '4060', name: 'Dress Rental Income', type: 'Revenue', description: 'Dress rental charges' },
        { code: '5000', name: 'Salary Expense', type: 'Expense', description: 'Staff salaries and wages' },
        { code: '5010', name: 'Maintenance Expense', type: 'Expense', description: 'Pool and facility maintenance' },
        { code: '5020', name: 'Utility Expense', type: 'Expense', description: 'Electricity, water, gas bills' },
        { code: '5030', name: 'Supplies Expense', type: 'Expense', description: 'Office and cleaning supplies' },
        { code: '5040', name: 'Beverage Cost (COGS)', type: 'Expense', description: 'Cost of beverages sold' },
        { code: '5050', name: 'Other Expense', type: 'Expense', description: 'Miscellaneous expenses' },
      ].map(a => ({ ...a, companyId: companyId.toString(), isActive: true }));
      await Account.insertMany(defaultAccounts);
      console.log(`  ✓ Seeded ${defaultAccounts.length} default accounts`);
    }

    console.log(`✓ Company database initialized for ${companyId}`);
  } catch (err) {
    throw new Error(`Failed to initialize company database: ${err.message}`);
  }
};
