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
      return res.status(403).json({ message: 'Company context required' });
    }

    const companyId = req.user.companyId;

    // Fetch company document from system database to get mongoUri
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (company.status !== 'active') {
      return res.status(403).json({ message: 'Company is suspended' });
    }

    // Get connection to company's database
    const companyDb = await getCompanyConnection(companyId.toString(), company.mongoUri);

    // Attach to request for use in route handlers
    req.companyDb = companyDb;
    req.companyId = companyId;

    return next();
  } catch (err) {
    console.error('Company context validation error:', err);
    return res.status(500).json({ message: 'Failed to validate company context', detail: err.message });
  }
};
