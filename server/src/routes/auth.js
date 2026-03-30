import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { signToken } from '../utils/jwt.js';
import { initializeCompanyDatabase } from '../utils/initCompanyDb.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * Register a new company
 * Creates Company + owner User account
 * Initializes company's dedicated database
 */
router.post('/register-company', async (req, res) => {
  try {
    const { companyName, ownerName, email, password } = req.body;

    // Validate input
    if (!companyName || !ownerName || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Create user first (without company initially)
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name: ownerName,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin', // First user is always admin (owner)
    });
    await user.save();

    // Now create company with user as owner
    const company = new Company({
      name: companyName,
      ownerId: user._id,
      // Generate database URI for this company
      mongoUri: `mongodb://127.0.0.1:27017/pool_${new mongoose.Types.ObjectId().toString()}`,
    });
    await company.save();

    // Update user with company reference
    user.companyId = company._id;
    await user.save();

    // Initialize company's database
    await initializeCompanyDatabase(company._id.toString(), company.mongoUri);

    // Generate JWT
    const token = signToken(user._id, company._id, user.role, user.name, user.email);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: company._id,
      },
      company: {
        id: company._id,
        name: company.name,
      },
    });
  } catch (err) {
    console.error('Register company error:', err);
    return res.status(500).json({ message: 'Failed to register company', detail: err.message });
  }
});

/**
 * Login endpoint
 * Updated to include companyId in JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase() })
      .populate('companyId');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password || '', user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // JWT now includes companyId
    const token = signToken(user._id, user.companyId._id, user.role, user.name, user.email);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        companyId: user.companyId._id,
      },
      company: {
        id: user.companyId._id,
        name: user.companyId.name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed', detail: err.message });
  }
});

/**
 * Get current user info
 */
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-passwordHash')
      .populate('companyId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId._id,
      },
      company: {
        id: user.companyId._id,
        name: user.companyId.name,
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ message: 'Failed to fetch user', detail: err.message });
  }
});

/**
 * Invite a manager to company
 * Admin only
 */
router.post('/invite-user', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { managerEmail, managerName } = req.body;
    const { companyId } = req.user;

    if (!managerEmail || !managerName) {
      return res.status(400).json({ message: 'Email and name required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create manager user
    const manager = new User({
      name: managerName,
      email: managerEmail.toLowerCase(),
      passwordHash,
      role: 'manager',
      companyId: companyId,
      invitedBy: req.user.id,
    });
    await manager.save();

    return res.status(201).json({
      message: 'Manager invited successfully',
      manager: {
        id: manager._id,
        name: manager.name,
        email: manager.email,
        role: manager.role,
        tempPassword, // Send this to the requester (email it to the manager separately)
      },
    });
  } catch (err) {
    console.error('Invite user error:', err);
    return res.status(500).json({ message: 'Failed to invite user', detail: err.message });
  }
});

export default router;
