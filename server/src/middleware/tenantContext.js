import { getCompanyConnection } from '../utils/companyDb.js';
import Company from '../models/Company.js';

/**
 * Middleware to validate company context and attach company database connection
 * Must be used after authRequired middleware
 * Ensures every request has a valid companyId from JWT
 * Attaches the company's database connection to req.companyDb
 */
export const validateCompanyContext = async (req, res, next) => {
  try {
    // Ensure user is authenticated (from authRequired middleware)
    if (!req.user || !req.user.companyId) {
      console.warn(`[TenantContext] Missing company context for user: ${req.user?.email || 'unknown'}`);
      return res.status(403).json({ message: 'Company context required' });
    }

    const companyId = req.user.companyId;
    console.log(`[TenantContext] Validating company context for: ${req.user.email} (Company ID: ${companyId})`);

    // Fetch company document from system database to get mongoUri
    const company = await Company.findById(companyId);
    if (!company) {
      console.error(`[TenantContext] Company not found: ${companyId}`);
      return res.status(404).json({ message: 'Company not found' });
    }

    if (company.status !== 'active') {
      console.warn(`[TenantContext] Company is not active: ${company.name} (Status: ${company.status})`);
      return res.status(403).json({ message: 'Company is suspended' });
    }

    // Get connection to company's database
    console.log(`[TenantContext] Establishing connection to company DB: ${company.mongoUri}`);
    const companyDb = await getCompanyConnection(companyId.toString(), company.mongoUri);
    console.log(`[TenantContext] ✓ Successfully connected to company DB for: ${company.name}`);

    // Attach to request for use in route handlers
    req.companyDb = companyDb;
    req.companyId = companyId;

    return next();
  } catch (err) {
    console.error(`[TenantContext] ✗ ERROR validating company context:`, err.message);
    console.error(`[TenantContext] Error details:`, err);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate company context',
      error: err.message,
    });
  }
};
