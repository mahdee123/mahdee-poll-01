import jwt from 'jsonwebtoken';

// Enforce JWT_SECRET in production
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'dev-secret';
})();

const JWT_EXPIRY = process.env.JWT_EXPIRY || '12h';

/**
 * Sign a JWT token with user and company context
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @param {string} role - User role (admin or manager)
 * @param {string} name - User name
 * @param {string} email - User email
 * @returns {string} - Signed JWT token
 */
export const signToken = (userId, companyId, role, name, email) => {
  return jwt.sign(
    {
      id: userId,
      companyId: companyId,
      role: role,
      name: name,
      email: email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {object} - Decoded token
 * @throws {Error} - If token is invalid
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
