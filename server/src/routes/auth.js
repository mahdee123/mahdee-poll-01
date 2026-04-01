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
 * Get current user info + company staff
 */
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-passwordHash')
      .populate('companyId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch all staff members in the company
    const staff = await User.find({ companyId: user.companyId._id })
      .select('-passwordHash')
      .lean();

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: 'Active',
        companyId: user.companyId._id,
        createdAt: user.createdAt,
      },
      company: {
        id: user.companyId._id,
        name: user.companyId.name,
        status: user.companyId.status === 'active' ? 'Active' : 'Suspended',
        createdAt: user.companyId.createdAt,
      },
      staff: staff.filter(s => s._id.toString() !== user._id.toString()).map(s => ({
        id: s._id,
        name: s.name,
        email: s.email,
        role: s.role,
        status: 'Active',
        companyId: s.companyId,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ message: 'Failed to fetch user', detail: err.message });
  }
});

/**
 * Create manager account manually (with email and password)
 * Admin only
 */
router.post('/invite-user', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { managerEmail, managerName, managerPassword } = req.body;
    const { companyId } = req.user;

    if (!managerEmail || !managerName) {
      return res.status(400).json({ message: 'Email and name required' });
    }

    if (!managerPassword) {
      return res.status(400).json({ message: 'Password required' });
    }

    if (managerPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash the provided password
    const passwordHash = await bcrypt.hash(managerPassword, 10);

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
      message: 'Manager account created successfully',
      manager: {
        id: manager._id,
        name: manager.name,
        email: manager.email,
        role: manager.role,
      },
    });
  } catch (err) {
    console.error('Create manager error:', err);
    return res.status(500).json({ message: 'Failed to create manager account', detail: err.message });
  }
});

/**
 * Update company information
 * Admin only
 */
router.patch('/company', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { name, status } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (name !== undefined && (!name || name.trim() === '')) {
      return res.status(400).json({ message: 'Company name cannot be empty' });
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (status !== undefined && ['active', 'suspended'].includes(status)) {
      updateData.status = status;
    }

    // Update company
    const company = await Company.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    return res.json({
      message: 'Company updated successfully',
      company: {
        id: company._id,
        name: company.name,
        status: company.status === 'active' ? 'Active' : 'Suspended',
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      },
    });
  } catch (err) {
    console.error('Update company error:', err);
    return res.status(500).json({ message: 'Failed to update company', detail: err.message });
  }
});

/**
 * Update user role
 * Admin only
 */
router.patch('/users/:userId/role', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (!role || !['admin', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Valid role required: admin or manager' });
    }

    // Find user and verify they belong to the company
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: User not in your company' });
    }

    // Prevent removing last admin
    if (user.role === 'admin' && role === 'manager') {
      const adminCount = await User.countDocuments({ companyId, role: 'admin' });
      if (adminCount === 1) {
        return res.status(400).json({ message: 'Cannot remove last admin from company' });
      }
    }

    user.role = role;
    await user.save();

    return res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({ message: 'Failed to update user role', detail: err.message });
  }
});

/**
 * Remove user from company
 * Admin only
 */
router.delete('/users/:userId', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { userId } = req.params;
    const { companyId } = req.user;
    const { confirmPassword } = req.body;

    // Find user and verify they belong to the company
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: User not in your company' });
    }

    // Prevent removing self
    if (user._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: 'Cannot remove yourself from company' });
    }

    // Prevent removing last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ companyId, role: 'admin' });
      if (adminCount === 1) {
        return res.status(400).json({ message: 'Cannot remove last admin from company' });
      }
    }

    // Verify admin password for security
    const adminUser = await User.findById(req.user.id);
    if (!confirmPassword || !(await bcrypt.compare(confirmPassword, adminUser.passwordHash))) {
      return res.status(401).json({ message: 'Invalid password confirmation' });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    return res.json({
      message: 'User removed successfully',
      removedUserId: userId,
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ message: 'Failed to remove user', detail: err.message });
  }
});

export default router;
