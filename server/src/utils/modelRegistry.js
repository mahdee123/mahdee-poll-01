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
      serviceType: { type: String, enum: ['Daily Entry', 'Training', 'Membership', 'Bill'] },
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
      transactionType: { type: String, enum: ['Purchase', 'MonthlyPayment', 'DuePayment'] },
      amountPaid: Number,
      dueAmount: Number,
      amountPerPerson: Number,
      numberOfPersons: Number,
    },
    { timestamps: true }
  ),

  Expense: new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      date: { type: Date, default: Date.now },
      title: String,
      category: { type: String, enum: ['Staff Salary', 'Maintenance', 'Utility', 'Supplies', 'Other'] },
      amount: Number,
      paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash'] },
      note: String,
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
