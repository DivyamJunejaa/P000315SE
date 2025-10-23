/**
 * MongoDB Client Connection Manager
 * 
 * Provides a singleton MongoDB client instance with proper connection pooling
 * and Hot Module Replacement (HMR) support for development environments.
 * 
 * Key Features:
 * - Singleton pattern to prevent multiple database connections
 * - Development mode: Preserves connection across HMR reloads
 * - Production mode: Creates fresh connection per deployment
 * - Environment-based configuration
 * - Type-safe global augmentation for development mode
 * 
 * Connection Pooling:
 * MongoDB driver automatically handles connection pooling. Each MongoClient
 * instance maintains a pool of connections that can be reused across requests,
 * which is essential for serverless environments like Vercel.
 * 
 * Usage:
 * ```typescript
 * import clientPromise from '@/lib/mongodb';
 * 
 * export default async function handler(req, res) {
 *   const client = await clientPromise;
 *   const db = client.db('myDatabase');
 *   const collection = db.collection('myCollection');
 *   // ... perform database operations
 * }
 * ```
 * 
 * Environment Variables Required:
 * - MONGODB_URI: MongoDB connection string (required)
 * - NODE_ENV: Environment mode ('development' or 'production')
 */

import { MongoClient, MongoClientOptions } from 'mongodb';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Global type augmentation for development mode
 * 
 * Extends the global object to include a MongoDB client promise.
 * This allows connection reuse during Hot Module Replacement in development.
 */
declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * MongoDB connection URI from environment variables
 * 
 * Format: mongodb://username:password@host:port/database
 * or: mongodb+srv://username:password@cluster.mongodb.net/database
 */
const uri: string = process.env.MONGODB_URI!;

/**
 * MongoDB client options
 * 
 * Additional configuration can be added here:
 * - maxPoolSize: Maximum number of connections in the pool (default: 100)
 * - minPoolSize: Minimum number of connections in the pool (default: 0)
 * - maxIdleTimeMS: Max time a connection can remain idle before closing
 * - serverSelectionTimeoutMS: Timeout for selecting a server (default: 30000)
 * - socketTimeoutMS: Socket timeout (default: 0, no timeout)
 * 
 * Example:
 * const options: MongoClientOptions = {
 *   maxPoolSize: 10,
 *   minPoolSize: 2,
 *   maxIdleTimeMS: 30000,
 * };
 */
const options: MongoClientOptions = {
    // Add any MongoDB client options here
    // maxPoolSize: 10,
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that MongoDB URI is configured
 * 
 * Throws an error at startup if MONGODB_URI is not set in environment.
 * This fails fast and prevents runtime errors in database operations.
 */
if (!uri) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
    );
}

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * MongoDB client instance
 * Initialized differently based on environment mode
 */
let client: MongoClient;

/**
 * Promise that resolves to connected MongoDB client
 * This promise is shared across all imports of this module
 */
let clientPromise: Promise<MongoClient>;

/**
 * Initialize MongoDB client based on environment
 * 
 * DEVELOPMENT MODE:
 * Uses global variable to cache the connection promise across HMR reloads.
 * During development, Next.js uses Hot Module Replacement which can cause
 * this module to be re-executed. Without caching in global, this would
 * create new connections on every code change, quickly exhausting the
 * connection pool.
 * 
 * PRODUCTION MODE:
 * Creates a fresh connection for each deployment. No global caching needed
 * since there's no HMR in production and the module is loaded once per
 * server instance.
 */
if (process.env.NODE_ENV === 'development') {
    // ========================================================================
    // Development Environment
    // ========================================================================

    /**
     * Check if global connection promise already exists
     * 
     * In development, we store the connection promise in the global object
     * to preserve it across HMR reloads. This prevents connection pool
     * exhaustion during active development.
     */
    if (!global._mongoClientPromise) {
        console.log('🔌 Creating new MongoDB connection (Development)');

        // Create new client instance
        client = new MongoClient(uri, options);

        // Store connection promise in global for reuse
        global._mongoClientPromise = client.connect();
    } else {
        console.log('♻️  Reusing existing MongoDB connection (Development)');
    }

    // Use the cached global promise
    clientPromise = global._mongoClientPromise;

} else {
    // ========================================================================
    // Production Environment
    // ========================================================================

    /**
     * Create fresh connection in production
     * 
     * In production, we don't use global caching because:
     * 1. No HMR, so module only loads once per instance
     * 2. Vercel serverless functions may have multiple instances
     * 3. Each instance should manage its own connection pool
     */
    console.log('🔌 Creating MongoDB connection (Production)');

    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

// ============================================================================
// Connection Event Handlers (Optional but Recommended)
// ============================================================================

/**
 * Set up connection event listeners for monitoring
 * 
 * These listeners help track connection health and debug issues.
 * Uncomment to enable connection monitoring.
 */
/*
clientPromise.then((client) => {
    console.log('✅ MongoDB connected successfully');
    
    // Monitor connection events
    client.on('connectionPoolCreated', () => {
        console.log('📊 Connection pool created');
    });
    
    client.on('connectionPoolClosed', () => {
        console.log('📊 Connection pool closed');
    });
    
    client.on('connectionCreated', () => {
        console.log('🔗 New connection created');
    });
    
    client.on('connectionClosed', () => {
        console.log('🔗 Connection closed');
    });
}).catch((error) => {
    console.error('❌ MongoDB connection error:', error);
});
*/

// ============================================================================
// Export
// ============================================================================

/**
 * Export the MongoDB client promise
 * 
 * This promise resolves to a connected MongoClient instance.
 * By exporting a promise rather than the client directly, we ensure
 * that connection is established before any database operations.
 * 
 * The promise is module-scoped, meaning it's shared across all imports,
 * ensuring singleton behavior and connection reuse.
 * 
 * @example
 * // In an API route
 * import clientPromise from '@/lib/mongodb';
 * 
 * export default async function handler(req, res) {
 *   try {
 *     const client = await clientPromise;
 *     const db = client.db('myDatabase');
 *     const users = await db.collection('users').find({}).toArray();
 *     res.json({ users });
 *   } catch (error) {
 *     res.status(500).json({ error: 'Database connection failed' });
 *   }
 * }
 * 
 * @example
 * // In a service class
 * import clientPromise from '@/lib/mongodb';
 * 
 * class UserService {
 *   static async getUsers() {
 *     const client = await clientPromise;
 *     const db = client.db('myDatabase');
 *     return db.collection('users').find({}).toArray();
 *   }
 * }
 */
export default clientPromise;

// ============================================================================
// Usage Guidelines and Best Practices
// ============================================================================

/*
 * ENVIRONMENT SETUP:
 * 
 * 1. Create .env.local file in project root:
 *    MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
 *    NODE_ENV=development
 * 
 * 2. For production (Vercel), set environment variables in project settings:
 *    - MONGODB_URI: Your production MongoDB connection string
 *    - NODE_ENV: production (automatically set by Vercel)
 * 
 * CONNECTION STRING FORMAT:
 * 
 * MongoDB Atlas:
 * mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
 * 
 * Self-hosted MongoDB:
 * mongodb://<username>:<password>@<host>:<port>/<database>?authSource=admin
 * 
 * Local Development:
 * mongodb://localhost:27017/<database>
 * 
 */