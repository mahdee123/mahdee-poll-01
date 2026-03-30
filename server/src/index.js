import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import trainingRoutes from './routes/training.js';
import membershipRoutes from './routes/memberships.js';
import packageRoutes from './routes/packages.js';
import reportRoutes from './routes/reports.js';
import expenseRoutes from './routes/expenses.js';
import User from './models/User.js';
import Company from './models/Company.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

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
app.use('/api/expenses', expenseRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ message: 'Server error', detail: err.message });
});

/**
 * Ensure default admin exists in system (for backwards compatibility / dev)
 * Creates a default company and admin user if none exist
 */
const ensureDefaultAdmin = async () => {
  try {
    // Check if any companies exist
    const existingCompany = await Company.findOne();
    if (existingCompany) {
      console.log(`✓ System already initialized with companies`);
      return;
    }

    const email = (process.env.ADMIN_EMAIL || 'admin@raya.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    // Create admin user first (without companyId initially)
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name: 'Admin',
      email,
      passwordHash,
      role: 'admin',
    });
    await user.save();

    // Now create default company with the user as owner
    const company = new Company({
      name: 'Default Pool',
      ownerId: user._id,
      mongoUri: process.env.DEFAULT_COMPANY_MONGO_URI || 'mongodb://127.0.0.1:27017/raya_pool_default',
    });
    await company.save();

    // Update user with company reference
    user.companyId = company._id;
    await user.save();

    console.log(`✓ Seeded default admin ${email} in company "${company.name}"`);
  } catch (err) {
    console.error('Error seeding default admin:', err);
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

    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();
