import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  const Package = getCompanyModel(req.companyDb, 'Package');
  const pkg = new Package({ ...req.body, companyId: req.companyId });
  await pkg.save();
  return res.status(201).json({ package: pkg });
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
  const Package = getCompanyModel(req.companyDb, 'Package');
  const pkg = await Package.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!pkg) return res.status(404).json({ message: 'Package not found' });
  pkg.active = !pkg.active;
  await pkg.save();
  return res.json({ package: pkg });
});

export default router;
