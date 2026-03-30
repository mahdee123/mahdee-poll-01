import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const Package = getCompanyModel(req.companyDb, 'Package');
    const pkg = new Package({ ...req.body, companyId: req.companyId });
    console.log(`[Package] Attempting to save Package: ${req.body.name} (Company: ${req.companyId})`);
    await pkg.save();
    console.log(`[Package] ✓ Package saved successfully with ID: ${pkg._id}`);
    return res.status(201).json({ package: pkg });
  } catch (err) {
    console.error(`[Package] ✗ ERROR in POST /:`, err.message);
    console.error(`[Package] Error details:`, err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save package',
      error: err.message,
      details: err.errors || null,
    });
  }
});

router.get('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Package = getCompanyModel(req.companyDb, 'Package');
  const packages = await Package.find({ companyId: req.companyId }).sort({ createdAt: -1 });
  return res.json({ packages });
});

router.patch('/:id', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Package = getCompanyModel(req.companyDb, 'Package');
  const pkg = await Package.findByIdAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    req.body,
    { new: true }
  );
  if (!pkg) return res.status(404).json({ message: 'Package not found' });
  return res.json({ package: pkg });
});

router.patch('/:id/status', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const Package = getCompanyModel(req.companyDb, 'Package');
    const pkg = await Package.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    pkg.active = !pkg.active;
    console.log(`[Package] Attempting to update Package status: ${pkg.name} (Active: ${pkg.active}, Company: ${req.companyId})`);
    await pkg.save();
    console.log(`[Package] ✓ Package status updated successfully (ID: ${pkg._id})`);
    return res.json({ package: pkg });
  } catch (err) {
    console.error(`[Package] ✗ ERROR in PATCH /:id/status:`, err.message);
    console.error(`[Package] Error details:`, err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update package',
      error: err.message,
      details: err.errors || null,
    });
  }
});

export default router;
