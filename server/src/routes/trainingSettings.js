import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validateCompanyContext } from '../middleware/tenantContext.js';
import { getCompanyModel } from '../utils/modelRegistry.js';

const router = express.Router();

const DEFAULT_SETTINGS = {
  ageGroups: [
    {
      label: '4-8',
      classes: { Regular: 16, Weekend: 16 },
      pricing: { Regular: 12000, Weekend: 13000 },
    },
    {
      label: '9+',
      classes: { Regular: 12, Weekend: 12 },
      pricing: { Regular: 9000, Weekend: 11000 },
    },
  ],
  batches: [
    { name: 'Regular', days: 30 },
    { name: 'Weekend', days: 40 },
  ],
  classSlots: [
    { id: 1, label: 'Class 01', startTime: '08:00 AM', endTime: '09:00 AM', period: 'Morning' },
    { id: 2, label: 'Class 02', startTime: '09:00 AM', endTime: '10:00 AM', period: 'Morning' },
    { id: 3, label: 'Class 03', startTime: '05:00 PM', endTime: '06:00 PM', period: 'Evening' },
    { id: 4, label: 'Class 04', startTime: '06:00 PM', endTime: '07:00 PM', period: 'Evening' },
  ],
  slotLimit: 15,
  maxMakeupClasses: 2,
  paymentMethods: ['Cash', 'Bank', 'bKash'],
};

// GET training settings (auto-create defaults if none exist)
router.get('/', authRequired, validateCompanyContext, async (req, res) => {
  try {
    const TrainingSettings = getCompanyModel(req.companyDb, 'TrainingSettings');

    let settings = await TrainingSettings.findOne({ companyId: req.companyId });

    if (!settings) {
      settings = new TrainingSettings({
        companyId: req.companyId,
        ...DEFAULT_SETTINGS,
      });
      await settings.save();
      console.log(`[TrainingSettings] Created default settings for company ${req.companyId}`);
    }

    return res.status(200).json({ settings });
  } catch (error) {
    console.error('[TrainingSettings] Error fetching settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch training settings',
      error: error.message,
    });
  }
});

// POST save/update training settings
router.post('/', authRequired, requireRole('admin'), validateCompanyContext, async (req, res) => {
  try {
    const { ageGroups, batches, classSlots, slotLimit, maxMakeupClasses, paymentMethods } = req.body;
    const TrainingSettings = getCompanyModel(req.companyDb, 'TrainingSettings');

    let settings = await TrainingSettings.findOne({ companyId: req.companyId });

    if (!settings) {
      settings = new TrainingSettings({
        companyId: req.companyId,
        ...DEFAULT_SETTINGS,
      });
    }

    if (ageGroups !== undefined) settings.ageGroups = ageGroups;
    if (batches !== undefined) settings.batches = batches;
    if (classSlots !== undefined) settings.classSlots = classSlots;
    if (slotLimit !== undefined) settings.slotLimit = slotLimit;
    if (maxMakeupClasses !== undefined) settings.maxMakeupClasses = maxMakeupClasses;
    if (paymentMethods !== undefined) settings.paymentMethods = paymentMethods;

    await settings.save();
    console.log(`[TrainingSettings] Updated settings for company ${req.companyId}`);

    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('[TrainingSettings] Error saving settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to save training settings',
      error: error.message,
    });
  }
});

export default router;
