import mongoose from 'mongoose';

const modelCache = new Map();

/**
 * Create schema definitions for company models
 * These schemas are the same for all companies
 */
const createSchemas = () => ({
  Member: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      name: { type: String, required: true },
      phone: String,
      address: String,
      plan: { type: String, enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] },
      startDate: Date,
      endDate: Date,
      status: { type: String, enum: ['Active', 'Expired', 'Inactive'], default: 'Active' },
      amountPaid: { type: Number, default: 0 },
      totalDue: { type: Number, default: 0 },
      lastPaymentDate: Date,
      advanceCredit: { type: Number, default: 0 },
      monthlyFeeAmount: { type: Number, default: 2000 },
      dueHistory: [
        {
          month: String,
          amount: Number,
          paid: { type: Boolean, default: false },
          date: Date,
          paidDate: Date,
          reason: String,
          type: { type: String, enum: ['Due', 'Payment'] },
        },
      ],
    },
    { timestamps: true }
  ),

  Student: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      name: { type: String, required: true },
      phone: String,
      ageGroup: { type: String, enum: ['4-8', '9+'] },
      batchType: { type: String, enum: ['Regular', 'Weekend'] },
      timeSlot: { type: String, enum: ['Morning', 'Evening'] },
      classSlot: { type: Number, enum: [1, 2, 3, 4] },
      totalClasses: Number,
      remainingClasses: Number,
      price: Number,
      durationDays: Number,
      startDate: Date,
      endDate: Date,
      makeupUsed: Number,
      status: { type: String, enum: ['active', 'expired'], default: 'active' },
      amountPaid: { type: Number, default: 0 },
      due: { type: Number, default: 0 },
      dueHistory: [
        {
          month: String,
          amount: Number,
          paid: Boolean,
        },
      ],
    },
    { timestamps: true }
  ),

  Package: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      name: { type: String, required: true },
      type: { type: String, enum: ['Training', 'Membership'] },
      price: { type: Number, required: true },
      durationDays: Number,
      totalClasses: Number,
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),

  ClassRecord: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      student: { type: mongoose.Schema.Types.ObjectId, required: true },
      date: { type: Date, required: true },
      status: { type: String, enum: ['Attended', 'Missed', 'Makeup'], required: true },
    },
    { timestamps: true }
  ),

  Transaction: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      name: String,
      phone: String,
      serviceType: { type: String, enum: ['Daily Entry', 'Training', 'Membership', 'Bill', 'Beverage', 'Hourly Session', 'Locker', 'Dress Rental'] },
      amount: Number,
      paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'] },
      date: { type: Date, default: Date.now },
      timeSlot: String,
      receiptId: String,
      price: Number,
      discount: Number,
      package: String,
      batch: String,
      duration: String,
      plan: String,
      startDate: Date,
      memberId: mongoose.Schema.Types.ObjectId,
      studentId: mongoose.Schema.Types.ObjectId,
      transactionType: { type: String, enum: ['Purchase', 'MonthlyPayment', 'DuePayment', 'HourlyPayment'] },
      amountPaid: Number,
      dueAmount: Number,
      amountPerPerson: Number,
      numberOfPersons: Number,
      sessionId: mongoose.Schema.Types.ObjectId,
      overtimeMinutes: Number,
      overtimeCharge: Number,
      beverageCharge: Number,
    },
    { timestamps: true }
  ),

  HourlySession: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      customerName: { type: String, required: true },
      phone: { type: String, default: '' },
      memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
      startTime: { type: Date, required: true, default: Date.now },
      plannedEndTime: { type: Date, required: true },
      actualEndTime: { type: Date, default: null },
      status: { type: String, enum: ['active', 'closed'], default: 'active' },
      hourlyRate: { type: Number, required: true, min: 0 },
      plannedHours: { type: Number, required: true, min: 1, default: 1 },
      baseCharge: { type: Number, required: true, min: 0, default: 0 },
      overtimeMinutes: { type: Number, default: 0 },
      overtimeCharge: { type: Number, default: 0 },
      beverageCharge: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], default: 'Cash' },
      transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
      notes: { type: String, default: '' },
      closedAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),

  BeverageProduct: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      name: { type: String, required: true },
      costPrice: { type: Number, required: true, min: 0 },
      sellingPrice: { type: Number, required: true, min: 0 },
      currentStock: { type: Number, required: true, default: 0, min: 0 },
      unit: { type: String, default: 'Bottle' },
      description: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  BeverageSale: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      items: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'BeverageProduct', required: true },
          productName: { type: String, required: true }, // Stored for historical tracking
          quantity: { type: Number, required: true, min: 1 },
          costPricePerUnit: { type: Number, required: true, min: 0 },
          sellingPricePerUnit: { type: Number, required: true, min: 0 },
          lineTotal: { type: Number, required: true }, // quantity × sellingPricePerUnit
          lineCost: { type: Number, required: true }, // quantity × costPricePerUnit
          lineProfit: { type: Number, required: true }, // lineTotal - lineCost
        },
      ],
      totalAmount: { type: Number, required: true }, // Sum of all line totals (revenue)
      totalCost: { type: Number, required: true }, // Sum of all line costs
      profit: { type: Number, required: true }, // Sum of all line profits
      profitMargin: { type: Number, required: true }, // (profit / totalAmount) × 100
      paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], required: true },
      date: { type: Date, default: Date.now, required: true, index: true },
      receiptId: { type: String, unique: true, index: true },
      notes: { type: String, default: '' },
      hourlySessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'HourlySession', default: null },
    },
    { timestamps: true }
  ),

  BeverageInventory: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      transactionType: { type: String, enum: ['Purchase', 'Sale'], required: true },
      quantity: { type: Number, required: true },
      pricePerUnit: { type: Number, required: true, min: 0 },
      runningBalance: { type: Number, required: true, min: 0 },
      reference: { type: String },
      date: { type: Date, default: Date.now, required: true, index: true },
      notes: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  BeverageCashFlow: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      date: { type: Date, required: true, index: true },
      openingBalance: { type: Number, default: 0 },
      totalSalesRevenue: { type: Number, default: 0 },
      totalWithdrawals: { type: Number, default: 0 },
      closingBalance: { type: Number, default: 0 },
      notes: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  BeverageCashWithdrawal: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      date: { type: Date, required: true, index: true },
      amount: { type: Number, required: true, min: 0 },
      reason: { type: String, required: true, trim: true },
      recordedBy: { type: String, default: 'Admin' },
    },
    { timestamps: true }
  ),

  OpeningBalance: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, unique: true },
      amount: { 
        type: Number, 
        required: [true, 'Opening balance amount is required'],
        default: 0
      },
      setByUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
      },
      setDate: {
        type: Date,
        default: Date.now
      },
      isLocked: {
        type: Boolean,
        default: true
      },
      note: { 
        type: String, 
        default: ''
      },
    },
    { timestamps: true }
  ),

  DailyBalance: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      date: { 
        type: Date, 
        required: true,
        index: true
      },
      openingBalance: { 
        type: Number, 
        required: true,
        default: 0
      },
      income: { 
        type: Number, 
        required: true,
        default: 0
      },
      expense: { 
        type: Number, 
        required: true,
        default: 0
      },
      closingBalance: { 
        type: Number, 
        required: true,
        default: 0
      },
    },
    { timestamps: true }
  ),

  CashMovement: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      date: { type: Date, required: true, index: true },
      type: {
        type: String,
        enum: ['DEPOSIT', 'WITHDRAWAL'],
        required: true,
      },
      category: {
        type: String,
        enum: [
          'Bank Deposit',
          'Bank Withdrawal',
          'Owner Addition',
          'Owner Withdrawal',
          'Petty Cash In',
          'Petty Cash Out',
          'Customer Advance',
          'Salary Payment',
          'Other',
        ],
        required: true,
      },
      amount: { type: Number, required: true, min: 0 },
      method: {
        type: String,
        enum: ['Cash', 'Bank', 'Check', 'bKash', 'Other'],
        default: 'Bank',
      },
      reason: { type: String, required: true },
      reference: { type: String, default: '' },
      notes: { type: String, default: '' },
      createdBy: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  Locker: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      lockerNumber: { type: String, required: true, index: true },
      status: {
        type: String,
        enum: ['Available', 'Occupied', 'Maintenance', 'Disabled'],
        default: 'Available',
        index: true,
      },
    },
    { timestamps: true }
  ),

  LockerAssignment: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      lockerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Locker' },
      memberId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      memberType: { type: String, enum: ['Member', 'Student', 'BillPayer'], required: true },
      memberName: { type: String, required: true },
      memberPhone: { type: String, default: '' },
      assignedTime: { type: Date, required: true, default: Date.now },
      returnedTime: { type: Date, default: null },
      status: { type: String, enum: ['Active', 'Returned'], default: 'Active', index: true },
      chargeType: { type: String, enum: ['None', 'SeparateTransaction', 'AttachedToExistingBill'], default: 'None' },
      chargeAmount: { type: Number, default: 0 },
      transactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      existingBillTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      assignedByAdmin: { type: String, default: '' },
      notes: { type: String, default: '' },
      isBillPayer: { type: Boolean, default: false },
      billPayerTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
  ),

  LockerSettings: new mongoose.Schema(
    {
      companyId: { type: String, required: true, unique: true, index: true },
      totalLockers: { type: Number, default: 0, min: 0 },
      lockerPrefix: { type: String, default: 'Locker' },
      pricingMode: { type: String, enum: ['Free', 'PaidPerUse', 'Fixed'], default: 'Free' },
      chargeAmount: { type: Number, default: 0, min: 0 },
      autoNumbering: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),

  Dress: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      dressNumber: { type: String, required: true, index: true },
      type: { type: String, required: true, index: true },
      chargeAmount: { type: Number, default: 0, min: 0 },
      status: {
        type: String,
        enum: ['Available', 'Rented', 'Maintenance', 'Disabled'],
        default: 'Available',
        index: true,
      },
    },
    { timestamps: true }
  ),

  DressRental: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      dressId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Dress' },
      memberId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      memberType: { type: String, enum: ['Member', 'Student', 'BillPayer'], required: true },
      memberName: { type: String, required: true },
      memberPhone: { type: String, default: '' },
      assignedTime: { type: Date, required: true, default: Date.now },
      returnedTime: { type: Date, default: null },
      status: { type: String, enum: ['Active', 'Returned'], default: 'Active', index: true },
      chargeType: { type: String, enum: ['None', 'SeparateTransaction', 'AttachedToExistingBill'], default: 'None' },
      chargeAmount: { type: Number, default: 0 },
      transactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      existingBillTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      billPayerTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      assignedByAdmin: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  DressRentalSettings: new mongoose.Schema(
    {
      companyId: { type: String, required: true, unique: true, index: true },
      dressTypes: [{
        name: { type: String, required: true },
        chargeAmount: { type: Number, default: 0, min: 0 },
        count: { type: Number, default: 1, min: 0 },
      }],
      prefix: { type: String, default: 'Dress' },
      autoNumbering: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),

  TrainingSettings: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
      ageGroups: [
        {
          label: { type: String, required: true },
          classes: {
            Regular: { type: Number, default: 12 },
            Weekend: { type: Number, default: 12 },
          },
          pricing: {
            Regular: { type: Number, default: 9000 },
            Weekend: { type: Number, default: 11000 },
          },
        },
      ],
      batches: [
        {
          name: { type: String, required: true },
          days: { type: Number, required: true, default: 30 },
        },
      ],
      classSlots: [
        {
          id: { type: Number, required: true },
          label: { type: String, required: true },
          startTime: { type: String, required: true },
          endTime: { type: String, required: true },
          period: { type: String, enum: ['Morning', 'Evening'], required: true },
        },
      ],
      slotLimit: { type: Number, default: 15, min: 1 },
      maxMakeupClasses: { type: Number, default: 2, min: 0 },
      paymentMethods: [{ type: String }],
    },
    { timestamps: true }
  ),

  Account: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      code: { type: String, required: true, index: true },
      name: { type: String, required: true },
      type: { type: String, enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'], required: true, index: true },
      parentCode: { type: String, default: null },
      isActive: { type: Boolean, default: true },
      description: { type: String, default: '' },
    },
    { timestamps: true }
  ),

  JournalEntry: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      date: { type: Date, required: true, index: true },
      description: { type: String, required: true },
      referenceType: { type: String, enum: ['Transaction', 'CashMovement', 'DailyExpense', 'OpeningBalance', 'Manual'], required: true },
      referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
      lines: [{
        accountCode: { type: String, required: true },
        accountName: { type: String, required: true },
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
      }],
      totalDebit: { type: Number, required: true },
      totalCredit: { type: Number, required: true },
      createdBy: { type: String, default: '' },
      reversedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      isReversal: { type: Boolean, default: false },
    },
    { timestamps: true }
  ),

  AccountBalance: new mongoose.Schema(
    {
      companyId: { type: String, required: true },
      accountCode: { type: String, required: true },
      accountName: { type: String, required: true },
      accountType: { type: String, required: true },
      period: { type: String, required: true },
      debitTotal: { type: Number, default: 0 },
      creditTotal: { type: Number, default: 0 },
      balance: { type: Number, default: 0 },
    },
    { timestamps: true }
  ),

  DailyExpense: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      date: { type: Date, required: true, index: true },
      categories: [{
        name: { type: String, required: true },
        subcategory: { type: String, default: '' },
        amount: { type: Number, required: true, min: 0 },
        notes: { type: String, default: '' },
      }],
      totalAmount: { type: Number, required: true, default: 0 },
      paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'], default: 'Cash' },
      recordedBy: { type: String, default: '' },
      notes: { type: String, default: '' },
      journalEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
  ),

  ExpenseCategory: new mongoose.Schema(
    {
      companyId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      color: { type: String, default: '#6366F1' },
      isActive: { type: Boolean, default: true },
      sortOrder: { type: Number, default: 0 },
      subcategories: [{
        name: { type: String, required: true },
        sortOrder: { type: Number, default: 0 },
      }],
    },
    { timestamps: true }
  ),
});

/**
 * Get a model from a company's database connection
 * Creates and caches schemas on the connection
 * @param {mongoose.Connection} connection - Company database connection
 * @param {string} modelName - Model name (Member, Student, Package, etc)
 * @returns {mongoose.Model}
 */
export const getCompanyModel = (connection, modelName) => {
  if (!connection || !modelName) {
    throw new Error('connection and modelName are required');
  }

  // Create cache key
  const cacheKey = `${connection.name || 'unknown'}-${modelName}`;

  // Return cached model if exists
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey);
  }

  const schemas = createSchemas();
  if (!schemas[modelName]) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  // Create model on the connection
  let model;
  try {
    model = connection.model(modelName, schemas[modelName]);
  } catch (err) {
    // Model already registered on this connection
    model = connection.model(modelName);
  }

  modelCache.set(cacheKey, model);
  return model;
};

/**
 * Initialize all schemas on a company's database connection
 * Called when creating a new company database
 * @param {mongoose.Connection} connection - Company database connection
 */
export const initializeCompanySchemas = (connection) => {
  const schemas = createSchemas();
  const modelNames = Object.keys(schemas);

  modelNames.forEach((modelName) => {
    try {
      connection.model(modelName, schemas[modelName]);
    } catch (err) {
      // Model already registered, ignore
    }
  });
};
