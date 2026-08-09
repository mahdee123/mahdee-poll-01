import mongoose from 'mongoose';

const connectionCache = new Map();

// Cap how many company DB connections we keep open at once. Each self-service
// signup previously created a connection that was cached forever, which is an
// easy way to exhaust the MongoDB connection limit. Once the cap is hit, the
// least-recently-used connection is closed to make room for the new one.
const MAX_CACHED_CONNECTIONS = Number(process.env.MAX_COMPANY_DB_CONNECTIONS || 50);

/**
 * Derive a per-company database URI by swapping the database name on the
 * system connection string, so company databases always live on the same
 * MongoDB host/cluster as the system database instead of a hardcoded host.
 * @param {string} companyId - Company ID, used as the database name suffix
 * @returns {string}
 */
export const buildCompanyMongoUri = (companyId) => {
  const base = process.env.SYSTEM_MONGODB_URI || 'mongodb://127.0.0.1:27017/pool_system';
  try {
    const url = new URL(base);
    url.pathname = `/pool_${companyId}`;
    return url.toString();
  } catch {
    return `mongodb://127.0.0.1:27017/pool_${companyId}`;
  }
};

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
      // 1 = connected. Refresh recency (Map preserves insertion order, so
      // delete+re-set moves this entry to the "most recently used" end).
      connectionCache.delete(companyId);
      connectionCache.set(companyId, cached);
      return cached;
    }
    // Connection no longer valid, remove from cache
    connectionCache.delete(companyId);
  }

  // Evict the least-recently-used connection if we're at capacity, so an
  // unbounded stream of new companies (e.g. via public signup) can't hold
  // open connections forever.
  if (connectionCache.size >= MAX_CACHED_CONNECTIONS) {
    const oldestKey = connectionCache.keys().next().value;
    const oldestConnection = connectionCache.get(oldestKey);
    connectionCache.delete(oldestKey);
    oldestConnection.close().catch((err) => {
      console.error(`Error closing evicted connection for company ${oldestKey}:`, err.message);
    });
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
