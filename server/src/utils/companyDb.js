import mongoose from 'mongoose';

const connectionCache = new Map();

/**
 * Get or create a Mongoose connection to a company's database
 * Caches connections to avoid reconnecting repeatedly
 * @param {string} companyId - Company ID (used as connection identifier)
 * @param {string} mongoUri - MongoDB connection URI
 * @returns {Promise<mongoose.Connection>}
 */
export const getCompanyConnection = async (companyId, mongoUri) => {
  if (!companyId || !mongoUri) {
    throw new Error('companyId and mongoUri are required');
  }

  // Return cached connection if exists
  if (connectionCache.has(companyId)) {
    const cached = connectionCache.get(companyId);
    if (cached.readyState === 1) {
      // 1 = connected
      return cached;
    }
    // Connection no longer valid, remove from cache
    connectionCache.delete(companyId);
  }

  // Create new connection
  try {
    const connection = await mongoose.createConnection(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      connection.on('connected', resolve);
      connection.on('error', reject);
      setTimeout(reject, 10000); // 10 second timeout
    });

    connectionCache.set(companyId, connection);
    return connection;
  } catch (err) {
    throw new Error(`Failed to connect to company database for ${companyId}: ${err.message}`);
  }
};

/**
 * Close a company's database connection
 * @param {string} companyId - Company ID
 */
export const closeCompanyConnection = async (companyId) => {
  if (connectionCache.has(companyId)) {
    const connection = connectionCache.get(companyId);
    await connection.close();
    connectionCache.delete(companyId);
  }
};

/**
 * Close all cached connections
 */
export const closeAllCompanyConnections = async () => {
  for (const [companyId, connection] of connectionCache.entries()) {
    try {
      await connection.close();
    } catch (err) {
      console.error(`Error closing connection for company ${companyId}:`, err);
    }
  }
  connectionCache.clear();
};
