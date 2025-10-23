/**
 * Handler Factory
 * 
 * Provides a Higher-Order Function for creating standardized Vercel API route handlers
 * with built-in middleware composition, error handling, and common functionality.
 * 
 * This factory pattern eliminates boilerplate code and ensures consistent behavior
 * across all API endpoints by automatically applying:
 * - CORS headers and preflight handling
 * - HTTP method validation
 * - Request body validation
 * - JWT authentication (optional)
 * - Centralized error handling
 * 
 * Key Features:
 * - Composable middleware pipeline
 * - Type-safe request/response handling
 * - Automatic error catching and formatting
 * - Declarative configuration via options
 * - Supports both authenticated and public endpoints
 * 
 * Benefits:
 * - DRY (Don't Repeat Yourself) principle
 * - Consistent error responses across all endpoints
 * - Simplified API route creation
 * - Easy to test and maintain
 * - Reduces common security mistakes
 * 
 * Usage:
 * ```typescript
 * export default createHandler(
 *   async (req, res) => {
 *     // Your handler logic here
 *     const data = await someOperation();
 *     ResponseUtils.send(res, ResponseUtils.success(data));
 *   },
 *   {
 *     requireAuth: true,
 *     allowedMethods: ['POST'],
 *     validator: (data) => {
 *       const errors = [];
 *       if (!data.email) errors.push('Email is required');
 *       return errors;
 *     }
 *   }
 * );
 * ```
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CorsUtils } from './CorsUtils';
import { ResponseUtils } from './ResponseUtils';
import { validateToken, AuthenticatedRequest } from '../middleware/Auth';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration options for creating an API handler
 * 
 * @property requireAuth - If true, wraps handler with JWT authentication
 * @property allowedMethods - Array of allowed HTTP methods (GET, POST, etc.)
 * @property validator - Optional function to validate request body
 */
interface HandlerOptions {
    /**
     * Requires valid JWT authentication for this endpoint
     * 
     * When true, the handler will only execute if a valid Bearer token
     * is provided in the Authorization header. The decoded user data
     * will be available in req.user.
     * 
     * Default: false (public endpoint)
     */
    requireAuth?: boolean;

    /**
     * Whitelist of allowed HTTP methods
     * 
     * If specified, only these HTTP methods will be accepted.
     * Other methods will return 405 Method Not Allowed.
     * 
     * Common values: ['GET'], ['POST'], ['PUT'], ['DELETE'], ['GET', 'POST']
     * 
     * If empty array or undefined, all methods are allowed.
     * 
     * Default: [] (all methods allowed)
     */
    allowedMethods?: string[];

    /**
     * Request body validation function
     * 
     * Function that validates the request body and returns array of errors.
     * Return empty array if validation passes.
     * 
     * Only runs if request has a body and validator is provided.
     * 
     * @param data - The request body to validate
     * @returns Array of error messages (empty if valid)
     * 
     * @example
     * validator: (data) => {
     *   const errors = [];
     *   if (!data.email) errors.push('Email is required');
     *   if (!data.password) errors.push('Password is required');
     *   return errors;
     * }
     */
    validator?: (data: any) => string[];
}

/**
 * Generic handler function type
 * 
 * @template T - Request type (VercelRequest or AuthenticatedRequest)
 * 
 * Handlers should be async and return Promise<void>.
 * Response should be sent using ResponseUtils.send().
 */
type HandlerFunction<T = VercelRequest> = (
    req: T,
    res: VercelResponse
) => Promise<void>;

// ============================================================================
// Handler Factory Function
// ============================================================================

/**
 * Creates a standardized API route handler with built-in middleware
 * 
 * This factory function wraps your handler with a middleware pipeline that
 * automatically handles common API concerns in the following order:
 * 
 * Execution Pipeline:
 * 1. CORS Headers: Set CORS headers on response
 * 2. OPTIONS Handling: Handle CORS preflight requests
 * 3. Method Validation: Verify HTTP method is allowed
 * 4. Body Validation: Validate request body if validator provided
 * 5. Authentication: Apply JWT validation if requireAuth is true
 * 6. Handler Execution: Execute your handler function
 * 7. Error Handling: Catch and format any errors
 * 
 * The factory ensures consistent behavior across all endpoints and
 * eliminates the need to repeat common middleware code.
 * 
 * @template T - Request type (inferred from handler signature)
 * @param handler - Your async handler function
 * @param options - Configuration options for the handler
 * @returns Wrapped handler ready to be exported as Vercel API route
 * 
 * @example
 * // Public endpoint that only accepts POST
 * export default createHandler(
 *   async (req, res) => {
 *     const user = await createUser(req.body);
 *     ResponseUtils.send(res, ResponseUtils.created(user));
 *   },
 *   {
 *     allowedMethods: ['POST'],
 *     validator: validateUserData
 *   }
 * );
 * 
 * @example
 * // Protected endpoint with authentication
 * export default createHandler(
 *   async (req: AuthenticatedRequest, res) => {
 *     const projects = await getProjectsByUserId(req.user.userId);
 *     ResponseUtils.send(res, ResponseUtils.success(projects));
 *   },
 *   {
 *     requireAuth: true,
 *     allowedMethods: ['GET']
 *   }
 * );
 * 
 * @example
 * // Simple public endpoint with no restrictions
 * export default createHandler(async (req, res) => {
 *   const health = { status: 'ok', timestamp: new Date() };
 *   ResponseUtils.send(res, ResponseUtils.success(health));
 * });
 */
export const createHandler = (
    handler: HandlerFunction<any>,
    options: HandlerOptions = {}
) => {
    // Extract and set default values for options
    const {
        requireAuth = false,
        allowedMethods = [],
        validator
    } = options;

    /**
     * Main wrapped handler function
     * 
     * This is the actual function that Vercel will invoke.
     * It executes the middleware pipeline before calling your handler.
     */
    const wrappedHandler = async (req: VercelRequest, res: VercelResponse) => {
        try {
            // ================================================================
            // STEP 1: CORS Configuration (Always First)
            // ================================================================

            /**
             * Set CORS headers on the response
             * 
             * This must be done before any response is sent, including
             * error responses. CORS headers allow browsers to make
             * cross-origin requests to this API.
             */
            CorsUtils.setCors(res, req);

            /**
             * Handle OPTIONS preflight requests
             * 
             * Browsers send OPTIONS requests before actual requests to
             * check CORS permissions. If this is an OPTIONS request,
             * respond immediately and don't execute the handler.
             * 
             * Returns true if OPTIONS was handled, false otherwise.
             */
            if (CorsUtils.handleOptions(req, res)) {
                // OPTIONS request handled, stop here
                return;
            }

            // ================================================================
            // STEP 2: HTTP Method Validation
            // ================================================================

            /**
             * Verify that the HTTP method is allowed
             * 
             * If allowedMethods is specified and the request method is not
             * in the list, return 405 Method Not Allowed.
             * 
             * Example: If allowedMethods is ['POST'], GET requests will fail.
             */
            if (allowedMethods.length > 0 && !allowedMethods.includes(req.method!)) {
                console.warn(`Method ${req.method} not allowed. Allowed: ${allowedMethods.join(', ')}`);
                return ResponseUtils.send(
                    res,
                    ResponseUtils.error('Method not allowed', 405)
                );
            }

            // ================================================================
            // STEP 3: Request Body Validation
            // ================================================================

            /**
             * Validate request body if validator is provided
             * 
             * Only runs if:
             * 1. Validator function is provided in options
             * 2. Request has a body
             * 
             * If validation fails, returns 400 Bad Request with error details.
             */
            if (validator && req.body) {
                console.log('Validating request body...');
                const errors = validator(req.body);

                if (errors.length > 0) {
                    console.warn('Validation failed:', errors);
                    return ResponseUtils.send(
                        res,
                        ResponseUtils.error('Validation failed', 400, errors)
                    );
                }

                console.log('Validation passed');
            }

            // ================================================================
            // STEP 4: Execute Handler
            // ================================================================

            /**
             * Execute the actual handler function
             * 
             * At this point, all validations have passed and the handler
             * can safely execute. The handler should use ResponseUtils.send()
             * to send the response.
             */
            console.log(`Executing handler for ${req.method} ${req.url}`);
            await handler(req, res);

        } catch (error: unknown) {
            // ================================================================
            // STEP 5: Error Handling
            // ================================================================

            /**
             * Centralized error handling
             * 
             * Catches any unhandled errors from the handler or middleware.
             * Automatically formats the error response and logs it.
             * 
             * Uses handleServiceError to infer appropriate status codes
             * based on error messages.
             */
            console.error('Handler error:', error);

            // Log additional error details for debugging
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }

            return ResponseUtils.send(
                res,
                ResponseUtils.handleServiceError(error)
            );
        }
    };

    // ========================================================================
    // STEP 6: Apply Authentication Wrapper (If Required)
    // ========================================================================

    /**
     * Conditionally wrap with authentication middleware
     * 
     * If requireAuth is true, wraps the entire handler with JWT validation.
     * This ensures authentication is checked AFTER CORS but BEFORE handler execution.
     * 
     * The authentication middleware:
     * - Validates Bearer token from Authorization header
     * - Decodes JWT and attaches user data to req.user
     * - Returns 401 if token is missing or invalid
     * 
     * If requireAuth is false, returns the handler as-is.
     */
    return requireAuth
        ? validateToken(wrappedHandler as HandlerFunction<AuthenticatedRequest>)
        : wrappedHandler;
};

// ============================================================================
// Usage Examples and Patterns
// ============================================================================

/*
 * EXAMPLE 1: Simple Public Endpoint
 * 
 * No authentication, no validation, accepts all methods
 * 
 * ```typescript
 * // api/health.ts
 * export default createHandler(async (req, res) => {
 *   const health = {
 *     status: 'ok',
 *     timestamp: new Date().toISOString(),
 *     uptime: process.uptime()
 *   };
 *   ResponseUtils.send(res, ResponseUtils.success(health));
 * });
 * ```
 * 
 * EXAMPLE 2: POST Endpoint with Validation
 * 
 * Public endpoint that only accepts POST and validates body
 * 
 * ```typescript
 * // api/users/register.ts
 * export default createHandler(
 *   async (req, res) => {
 *     const user = await createUser(req.body);
 *     ResponseUtils.send(res, ResponseUtils.created(user, 'User registered'));
 *   },
 *   {
 *     allowedMethods: ['POST'],
 *     validator: (data) => {
 *       const errors = [];
 *       if (!data.email) errors.push('Email is required');
 *       if (!data.password) errors.push('Password is required');
 *       if (data.password?.length < 8) errors.push('Password must be at least 8 characters');
 *       return errors;
 *     }
 *   }
 * );
 * ```
 * 
 * EXAMPLE 3: Protected Endpoint with Authentication
 * 
 * Requires JWT token, only accepts GET
 * 
 * ```typescript
 * // api/projects/index.ts
 * export default createHandler(
 *   async (req: AuthenticatedRequest, res) => {
 *     const projects = await getProjectsByUserId(req.user.userId);
 *     ResponseUtils.send(res, ResponseUtils.success(projects));
 *   },
 *   {
 *     requireAuth: true,
 *     allowedMethods: ['GET']
 *   }
 * );
 * ```
 * 
 * EXAMPLE 4: Protected Endpoint with Validation
 * 
 * Requires authentication, validates body, only accepts POST
 * 
 * ```typescript
 * // api/projects/create.ts
 * export default createHandler(
 *   async (req: AuthenticatedRequest, res) => {
 *     const project = await createProject({
 *       ...req.body,
 *       userId: req.user.userId
 *     });
 *     ResponseUtils.send(res, ResponseUtils.created(project));
 *   },
 *   {
 *     requireAuth: true,
 *     allowedMethods: ['POST'],
 *     validator: (data) => {
 *       const errors = [];
 *       if (!data.projectTitle) errors.push('Project title is required');
 *       if (!data.projectAim) errors.push('Project aim is required');
 *       return errors;
 *     }
 *   }
 * );
 * ```
 * 
 * EXAMPLE 5: Multiple Methods with Different Logic
 * 
 * Handle GET and POST in same endpoint
 * 
 * ```typescript
 * // api/projects/[id].ts
 * export default createHandler(
 *   async (req: AuthenticatedRequest, res) => {
 *     const { id } = req.query;
 *     
 *     if (req.method === 'GET') {
 *       const project = await getProject(id as string, req.user.userId);
 *       return ResponseUtils.send(res, ResponseUtils.success(project));
 *     }
 *     
 *     if (req.method === 'PUT') {
 *       const updated = await updateProject(id as string, req.body, req.user.userId);
 *       return ResponseUtils.send(res, ResponseUtils.updated(updated));
 *     }
 *   },
 *   {
 *     requireAuth: true,
 *     allowedMethods: ['GET', 'PUT'],
 *     validator: (data) => {
 *       // Only validate on PUT
 *       const errors = [];
 *       if (!data.projectTitle) errors.push('Title is required');
 *       return errors;
 *     }
 *   }
 * );
 * ```
 * 
 */