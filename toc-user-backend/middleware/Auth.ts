/**
 * Authentication Middleware
 * 
 * Provides JWT-based authentication for Vercel serverless functions.
 * Implements a Higher-Order Function (HOF) pattern to wrap API handlers
 * with authentication logic.
 * 
 * Key Features:
 * - JWT token validation using jsonwebtoken library
 * - Type-safe request augmentation with user data
 * - CORS preflight (OPTIONS) request handling
 * - Standardized error responses
 * - Environment-based JWT secret configuration
 * 
 * Security Considerations:
 * - Tokens are validated against JWT_SECRET from environment variables
 * - Invalid or missing tokens result in 401 Unauthorized responses
 * - Token payload is typed for type safety
 * - OPTIONS requests bypass authentication for CORS compatibility
 * 
 * Usage:
 * ```typescript
 * export default validateToken(async (req, res) => {
 *   const userId = req.user.userId; // Type-safe access to user data
 *   // Your protected route logic here
 * });
 * ```
 */

import * as jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CorsUtils } from '../utils/CorsUtils';



/**
 * JWT payload structure representing an authenticated user
 * 
 * Properties:
 * - userId: Unique identifier for the user
 * - email: User's email address
 * - sub: Subject claim (typically user identifier, JWT standard)
 * - exp: Token expiration timestamp (Unix epoch, JWT standard)
 * - iat: Token issued-at timestamp (Unix epoch, JWT standard)
 * 
 * Note: exp and iat are optional as they're automatically added by JWT library
 */
export interface User {
    userId: number;
    email: string;
    sub: string;
    exp?: number;
    iat?: number;
}

/**
 * Extended Vercel request interface with authenticated user data
 * 
 * After successful authentication, the middleware attaches the decoded
 * JWT payload to the request object for use in downstream handlers.
 */
export interface AuthenticatedRequest extends VercelRequest {
    user: User;
}

/**
 * Handler function type for authenticated routes
 * 
 * These handlers receive an AuthenticatedRequest with guaranteed user data.
 */
type AuthenticatedHandler = (
    req: AuthenticatedRequest,
    res: VercelResponse
) => void | Promise<void | VercelResponse>;

/**
 * Handler function type for regular (unauthenticated) routes
 * 
 * Standard Vercel handler signature without user augmentation.
 */
type Handler = (
    req: VercelRequest,
    res: VercelResponse
) => void | Promise<void | VercelResponse>;



/**
 * JWT secret key for token verification
 * 
 * SECURITY WARNING:
 * - In production, JWT_SECRET must be set in environment variables
 * - "dev-secret" fallback should NEVER be used in production
 * - Secret should be cryptographically strong (min 256 bits)
 * - Rotate secrets periodically for enhanced security
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * HTTP status code for unauthorized requests
 */
const HTTP_UNAUTHORIZED = 401;



/**
 * Extracts Bearer token from Authorization header
 * 
 * Expected header format: "Bearer <token>"
 * Returns undefined if header is missing or malformed.
 * 
 * @param authHeader - Authorization header value
 * @returns Extracted JWT token or undefined
 */
function extractBearerToken(authHeader: string | undefined): string | undefined {
    return authHeader?.replace('Bearer ', '');
}

/**
 * Checks if the request is a CORS preflight request
 * 
 * CORS preflight requests use the OPTIONS method and should be allowed
 * through without authentication to enable cross-origin API calls.
 * 
 * @param method - HTTP method from request
 * @returns True if request is OPTIONS, false otherwise
 */
function isCorsPreflightRequest(method: string | undefined): boolean {
    return method === 'OPTIONS';
}

/**
 * Creates a standardized 401 Unauthorized error response
 * 
 * Provides consistent error structure across all authentication failures.
 * 
 * @param res - Vercel response object
 * @param errorMessage - Specific error message to return
 * @returns Vercel response with 401 status
 */
function sendUnauthorizedResponse(
    res: VercelResponse,
    errorMessage: string
): VercelResponse {
    return res.status(HTTP_UNAUTHORIZED).json({
        success: false,
        error: errorMessage,
        statusCode: HTTP_UNAUTHORIZED
    });
}

/**
 * Verifies and decodes a JWT token
 * 
 * Validates token signature and expiration using the JWT_SECRET.
 * Throws an error if token is invalid, expired, or malformed.
 * 
 * @param token - JWT token string to verify
 * @returns Decoded user payload from token
 * @throws Error if token verification fails
 */
function verifyJwtToken(token: string): User {
    return jwt.verify(token, JWT_SECRET) as User;
}



/**
 * Authentication middleware using Higher-Order Function pattern
 * 
 * Wraps an authenticated handler with JWT validation logic.
 * This middleware performs the following steps:
 * 
 * 1. CORS Preflight Check: Allow OPTIONS requests through without auth
 * 2. Token Extraction: Extract JWT from Authorization header
 * 3. Token Validation: Verify token signature and expiration
 * 4. Request Augmentation: Attach decoded user data to request
 * 5. Handler Execution: Call the original handler with authenticated request
 * 
 * Error Handling:
 * - Missing token: 401 "No token provided"
 * - Invalid/expired token: 401 "Invalid token"
 * - Malformed token: 401 "Invalid token"
 * 
 * CORS Compatibility:
 * Browser CORS preflight requests (OPTIONS) bypass authentication.
 * This is necessary for cross-origin requests to function properly.
 * The actual request (POST, GET, etc.) will still require authentication.
 * 
 * Security Flow:
 * ```
 * Client Request → Extract Token → Verify JWT → Add User to Request → Handler
 *                        ↓              ↓
 *                   No Token      Invalid Token
 *                        ↓              ↓
 *                    401 Error     401 Error
 * ```
 * 
 * @param handler - The authenticated handler to wrap
 * @returns Wrapped handler with authentication logic
 * 
 * @example
 * // Protect an API route
 * export default validateToken(async (req, res) => {
 *   const { userId, email } = req.user;
 *   return res.json({ message: `Hello ${email}` });
 * });
 * 
 * @example
 * // Access user data in handler
 * export default validateToken(async (req, res) => {
 *   const projects = await getProjectsByUserId(req.user.userId);
 *   return res.json({ projects });
 * });
 */
export const validateToken = (handler: AuthenticatedHandler): Handler => {
    return async (req: VercelRequest, res: VercelResponse) => {
        try {
            // Always set CORS headers so browsers can read any response
            CorsUtils.setCors(res, req);
            // Handle CORS preflight immediately
            if (CorsUtils.handleOptions(req, res)) {
                return;
            }

            // Maintain compatibility with existing preflight detection
            if (isCorsPreflightRequest(req.method)) {
                console.log('CORS preflight request detected, responding with CORS headers');
                return; // Already handled above
            }

            // STEP 2: Extract Bearer token from Authorization header
            const token = extractBearerToken(req.headers.authorization);

            // STEP 3: Validate token presence
            if (!token) {
                console.warn('Authentication failed: No token provided');
                return sendUnauthorizedResponse(res, 'No token provided');
            }

            // STEP 4: Verify and decode JWT token
            const decoded = verifyJwtToken(token);

            console.log(`Authentication successful for user: ${decoded.email}`);

            // STEP 5: Augment request with decoded user data
            (req as AuthenticatedRequest).user = decoded;

            // STEP 6: Call the original handler with authenticated request
            return handler(req as AuthenticatedRequest, res);

        } catch (error: unknown) {
            // JWT verification failures (invalid signature, expired token, etc.)
            console.error('Authentication error:', error);

            if (error instanceof jwt.JsonWebTokenError) {
                console.error('JWT Error:', error.message);
            } else if (error instanceof jwt.TokenExpiredError) {
                console.error('Token expired at:', error.expiredAt);
            }

            return sendUnauthorizedResponse(res, 'Invalid token');
        }
    };
};

