import { validateCompanyContext } from './tenantContext.js';

/**
 * Global middleware to ensure tenant context validation
 * This is applied to all authenticated routes to prevent accidental data leaks
 * 
 * Requirements:
 * - Must be applied AFTER authRequired middleware
 * - Validates company existence and status
 * - Attaches req.companyDb and req.companyId to request
 * 
 * Usage in index.js:
 * app.use(authRequired);
 * app.use(ensureTenantContext);
 * app.use(routes);
 */
export const ensureTenantContext = async (req, res, next) => {
  // Skip public routes (login, register, etc.)
  const publicRoutes = ['/auth/login', '/auth/register-company'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Skip unauthenticated requests
  if (!req.user) {
    return next();
  }

  // For all authenticated routes, validate tenant context
  try {
    await validateCompanyContext(req, res, next);
  } catch (error) {
    return res.status(403).json({
      message: 'Access denied: Unable to validate company context',
      error: error.message
    });
  }
};

export default ensureTenantContext;
