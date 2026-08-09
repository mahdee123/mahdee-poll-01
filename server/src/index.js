import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { authRequired } from './middleware/auth.js';
import { validateCompanyContext } from './middleware/tenantContext.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import trainingRoutes from './routes/training.js';
import membershipRoutes from './routes/memberships.js';
import packageRoutes from './routes/packages.js';
import reportRoutes from './routes/reports.js';
import cashMovementRoutes from './routes/cashMovements.js';
import beverageRoutes from './routes/beverages.js';
import hourlySessionRoutes from './routes/hourlySessions.js';
import diagnosticRoutes from './routes/diagnostic.js';
import openingBalanceRoutes from './routes/openingBalance.js';
import lockerRoutes from './routes/lockers.js';
import dressRentalRoutes from './routes/dressRentals.js';
import accountRoutes from './routes/accounts.js';
import journalRoutes from './routes/journal.js';
import dailyExpenseRoutes from './routes/dailyExpenses.js';
import expenseCategoryRoutes from './routes/expenseCategories.js';
import trainingSettingsRoutes from './routes/trainingSettings.js';
import { getCompanyConnection, buildCompanyMongoUri } from './utils/companyDb.js';
import { initializeCompanySchemas, getCompanyModel } from './utils/modelRegistry.js';
import User from './models/User.js';
import Company from './models/Company.js';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cash-movements', cashMovementRoutes);
app.use('/api/beverages', beverageRoutes);
app.use('/api/hourly-sessions', hourlySessionRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/opening-balance', openingBalanceRoutes);
app.use('/api/lockers', lockerRoutes);
app.use('/api/dress-rentals', dressRentalRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/daily-expenses', dailyExpenseRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/training/settings', trainingSettingsRoutes);

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, '..', '..', 'client', 'dist');

import { existsSync } from 'fs';
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      return res.sendFile(join(clientDistPath, 'index.html'));
    }
    return res.status(404).json({ message: 'Not found' });
  });
} else {
  app.use((req, res) => {
    return res.status(404).json({ message: 'Not found' });
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({
    message: 'Server error',
    // Only leak error internals outside production
    ...(isProduction ? {} : { detail: err.message }),
  });
});

/**
 * Seed a default admin + company on a completely fresh install only.
 * Never touches an existing admin account, so restarts/redeploys don't
 * reset a real admin's password or reassign their company.
 */
const ensureDefaultAdmin = async () => {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@raya.com').toLowerCase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Admin already provisioned - leave credentials/company assignment alone.
      return;
    }

    const totalUsers = await User.countDocuments();
    if (totalUsers > 0) {
      // System already has real accounts (e.g. via self-service signup);
      // don't inject an unrelated default admin into it.
      return;
    }

    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name: 'Admin',
      email,
      passwordHash,
      role: 'admin',
    });
    await user.save();
    console.log(`✓ Created initial admin user ${email}`);

    // Falls back to a database on the same host/cluster as the system DB
    // (same pattern as self-service company registration) unless an explicit
    // override is provided - no need to hand-configure a second Mongo URI.
    const company = new Company({
      name: 'Default Pool',
      ownerId: user._id,
      mongoUri: process.env.DEFAULT_COMPANY_MONGO_URI || buildCompanyMongoUri('default'),
    });
    await company.save();
    console.log(`✓ Created default company "${company.name}"`);

    user.companyId = company._id;
    await user.save();
  } catch (err) {
    console.error('Error ensuring default admin:', err);
  }
};

const start = async () => {
  try {
    // Connect to system database (contains Company, User, etc)
    const systemDbUri = process.env.SYSTEM_MONGODB_URI || 'mongodb://127.0.0.1:27017/pool_system';
    await connectDB(systemDbUri);
    console.log(`✓ Connected to system database: ${systemDbUri}`);

    // Initialize system database
    await ensureDefaultAdmin();

    // Run migrations for all existing companies
    try {
      const companies = await Company.find({});
      for (const company of companies) {
        const companyDbUri = company.mongoUri;
        const companyDb = await getCompanyConnection(company._id.toString(), companyDbUri);
        
        // Initialize schemas for this company
        initializeCompanySchemas(companyDb);
      }
    } catch (migrationErr) {
      console.warn('Migration error (non-blocking):', migrationErr.message);
    }

    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();
