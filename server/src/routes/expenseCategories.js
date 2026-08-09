import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { name: 'Salary', color: '#EF4444', sortOrder: 0 },
  { name: 'Maintenance', color: '#F97316', sortOrder: 1 },
  { name: 'Utility', color: '#F59E0B', sortOrder: 2 },
  { name: 'Supplies', color: '#22C55E', sortOrder: 3 },
  { name: 'Beverage Cost', color: '#3B82F6', sortOrder: 4 },
  { name: 'Other', color: '#8B5CF6', sortOrder: 5 },
];

// List all active categories for a company
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');

    let categories = await ExpenseCategory.find({
      companyId: req.companyId,
      isActive: true,
    }).sort({ sortOrder: 1, name: 1 }).lean();

    // Auto-seed default categories if none exist
    if (categories.length === 0) {
      const seeded = DEFAULT_CATEGORIES.map(c => ({
        ...c,
        companyId: req.companyId,
        isActive: true,
      }));
      await ExpenseCategory.insertMany(seeded);
      categories = await ExpenseCategory.find({
        companyId: req.companyId,
        isActive: true,
      }).sort({ sortOrder: 1, name: 1 }).lean();
    }

    return res.json({ categories });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new category
router.post('/', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');

    // Check duplicate
    const existing = await ExpenseCategory.findOne({
      companyId: req.companyId,
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    // Get next sort order
    const lastCategory = await ExpenseCategory.findOne({ companyId: req.companyId }).sort({ sortOrder: -1 }).lean();
    const nextSort = (lastCategory?.sortOrder || 0) + 1;

    const category = new ExpenseCategory({
      companyId: req.companyId,
      name: name.trim(),
      color: color || '#6366F1',
      sortOrder: nextSort,
    });
    await category.save();

    return res.status(201).json({ category });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');
    const category = await ExpenseCategory.findOne({ _id: id, companyId: req.companyId });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name && name.trim()) {
      // Check duplicate name (excluding self)
      const duplicate = await ExpenseCategory.findOne({
        _id: { $ne: id },
        companyId: req.companyId,
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        isActive: true,
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Category name already exists' });
      }
      category.name = name.trim();
    }
    if (color) category.color = color;

    await category.save();
    return res.json({ category });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete category (soft delete)
router.delete('/:id', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');

    const category = await ExpenseCategory.findOne({ _id: id, companyId: req.companyId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    category.isActive = false;
    await category.save();

    return res.json({ message: 'Category deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUBCATEGORY ENDPOINTS
// ============================================

// Add subcategory to a category
router.post('/:id/subcategories', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subcategory name is required' });
    }

    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');
    const category = await ExpenseCategory.findOne({ _id: id, companyId: req.companyId });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check duplicate subcategory name
    const duplicate = category.subcategories.find(
      s => s.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({ error: 'Subcategory already exists' });
    }

    const nextSort = category.subcategories.length > 0
      ? Math.max(...category.subcategories.map(s => s.sortOrder || 0)) + 1
      : 0;

    category.subcategories.push({ name: name.trim(), sortOrder: nextSort });
    await category.save();

    return res.status(201).json({ category });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update subcategory
router.put('/:id/subcategories/:subId', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id, subId } = req.params;
    const { name } = req.body;

    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');
    const category = await ExpenseCategory.findOne({ _id: id, companyId: req.companyId });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subId);
    if (!subcategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    if (name && name.trim()) {
      // Check duplicate
      const duplicate = category.subcategories.find(
        s => s._id.toString() !== subId && s.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Subcategory name already exists' });
      }
      subcategory.name = name.trim();
    }

    await category.save();
    return res.json({ category });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete subcategory
router.delete('/:id/subcategories/:subId', authRequired, requireRole('admin', 'manager'), validateCompanyContext, async (req, res) => {
  try {
    const { id, subId } = req.params;

    const ExpenseCategory = getCompanyModel(req.companyDb, 'ExpenseCategory');
    const category = await ExpenseCategory.findOne({ _id: id, companyId: req.companyId });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    category.subcategories = category.subcategories.filter(
      s => s._id.toString() !== subId
    );
    await category.save();

    return res.json({ category });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
