/**
 * Response Utilities
 * 
 * Provides standardized API response formatting for Vercel serverless functions.
 * Implements consistent response structures across all endpoints with proper
 * HTTP status codes and type-safe response objects.
 * 
 * Key Features:
 * - Standardized success/error response formats
 * - HTTP status code helpers for common scenarios
 * - Type-safe response objects using ApiResponse interface
 * - Automatic error parsing and status code inference
 * - Single source of truth for response formatting
 * 
 * Usage:
 * ```typescript
 * // Success response
 * return ResponseUtils.send(res, ResponseUtils.success(data));
 * 
 * // Error response
 * return ResponseUtils.send(res, ResponseUtils.notFound('User not found'));
 * 
 * // Handle service errors automatically
 * return ResponseUtils.send(res, ResponseUtils.handleServiceError(error));
 * ```
 */

import type { VercelResponse } from '@vercel/node';
import type { ApiResponse } from '../entities/ApiResponse';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Valid HTTP status codes as number type
 * ApiResponse interface expects numbers, not strings
 */
type HttpStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;

// ============================================================================
// HTTP Status Code Constants
// ============================================================================

/**
 * Standard HTTP status codes used across the application
 * Typed as const to ensure type safety
 */
const HTTP_STATUS: Record<string, HttpStatusCode> = {
    OK: 200,              // Request succeeded
    CREATED: 201,         // Resource created successfully
    BAD_REQUEST: 400,     // Client error - invalid request
    UNAUTHORIZED: 401,    // Authentication required
    FORBIDDEN: 403,       // Authenticated but insufficient permissions
    NOT_FOUND: 404,       // Resource does not exist
    CONFLICT: 409,        // Resource already exists or state conflict
    SERVER_ERROR: 500     // Internal server error
} as const;

// ============================================================================
// Response Utility Class
// ============================================================================

/**
 * Static utility class for creating standardized API responses
 * 
 * All methods are static and return ApiResponse objects that can be
 * sent to the client using the send() method.
 */
export class ResponseUtils {

    // ========================================================================
    // Core Response Builders
    // ========================================================================

    /**
     * Creates a successful response with data
     * 
     * Used for successful operations that return data to the client.
     * Default status is 200 OK.
     * 
     * @param data - The data payload to return (any type)
     * @param message - Success message (default: 'Success')
     * @param statusCode - HTTP status code (default: 200)
     * @returns Formatted success response object
     * 
     * @example
     * const user = { id: 1, name: 'John' };
     * return ResponseUtils.success(user, 'User retrieved');
     */
    static success(data: any, message: string = 'Success', statusCode: number = HTTP_STATUS.OK): ApiResponse {
        return {
            success: true,
            message,
            data,
            statusCode
        };
    }

    /**
     * Creates an error response with optional details
     * 
     * Used for all error scenarios. Additional error details can be
     * included for debugging or validation error messages.
     * 
     * @param message - Error message describing what went wrong
     * @param statusCode - HTTP status code (default: 500)
     * @param details - Optional additional error details or validation errors
     * @returns Formatted error response object
     * 
     * @example
     * return ResponseUtils.error('User not found', 404);
     * 
     * @example
     * // With validation details
     * return ResponseUtils.error('Validation failed', 400, ['Email is required']);
     */
    static error(message: string, statusCode: number = HTTP_STATUS.SERVER_ERROR, details?: any): ApiResponse {
        return {
            success: false,
            message,
            error: details,
            statusCode
        };
    }

    /**
     * Sends an ApiResponse object to the client
     * 
     * Sets the HTTP status code and sends JSON response.
     * This is the final step in the response chain.
     * 
     * @param res - Vercel response object
     * @param response - Formatted ApiResponse object to send
     * 
     * @example
     * const response = ResponseUtils.success(data);
     * ResponseUtils.send(res, response);
     * 
     * @example
     * // Inline usage
     * return ResponseUtils.send(res, ResponseUtils.notFound());
     */
    static send(res: VercelResponse, response: ApiResponse): void {
        res.status(response.statusCode).json(response);
    }

    // ========================================================================
    // Success Response Helpers (2xx Status Codes)
    // ========================================================================

    /**
     * Creates a 201 Created response
     * 
     * Used when a new resource has been successfully created.
     * Returns 201 status code which is semantically correct for creation.
     * 
     * @param data - The created resource data
     * @param message - Success message (default: 'Created successfully')
     * @returns 201 Created response
     * 
     * @example
     * const newUser = await createUser(userData);
     * return ResponseUtils.send(res, ResponseUtils.created(newUser));
     */
    static created(data: any, message: string = 'Created successfully'): ApiResponse {
        return this.success(data, message, HTTP_STATUS.CREATED);
    }

    /**
     * Creates a 200 OK response for successful updates
     * 
     * Used when a resource has been successfully updated.
     * Returns updated resource data.
     * 
     * @param data - The updated resource data
     * @param message - Success message (default: 'Updated successfully')
     * @returns 200 OK response with updated data
     * 
     * @example
     * const updatedProject = await updateProject(projectId, updates);
     * return ResponseUtils.send(res, ResponseUtils.updated(updatedProject));
     */
    static updated(data: any, message: string = 'Updated successfully'): ApiResponse {
        return this.success(data, message, HTTP_STATUS.OK);
    }

    /**
     * Creates a 200 OK response for successful deletions
     * 
     * Used when a resource has been successfully deleted.
     * Data parameter is optional since deleted resources typically don't
     * return data (can return deletion confirmation or empty object).
     * 
     * @param data - Optional data to return (default: empty object)
     * @param message - Success message (default: 'Deleted successfully')
     * @returns 200 OK response
     * 
     * @example
     * await deleteProject(projectId);
     * return ResponseUtils.send(res, ResponseUtils.deleted());
     * 
     * @example
     * // With confirmation data
     * return ResponseUtils.send(res, ResponseUtils.deleted({ id: projectId }));
     */
    static deleted(data: any = {}, message: string = 'Deleted successfully'): ApiResponse {
        return this.success(data, message, HTTP_STATUS.OK);
    }

    // ========================================================================
    // Client Error Response Helpers (4xx Status Codes)
    // ========================================================================

    /**
     * Creates a 400 Bad Request response for validation errors
     * 
     * Used when request data fails validation.
     * Includes array of specific validation error messages.
     * 
     * @param errors - Array of validation error messages
     * @returns 400 Bad Request response with error details
     * 
     * @example
     * const errors = ['Email is required', 'Password must be at least 8 characters'];
     * return ResponseUtils.send(res, ResponseUtils.validationError(errors));
     */
    static validationError(errors: string[]): ApiResponse {
        return this.error('Validation failed', HTTP_STATUS.BAD_REQUEST, errors);
    }

    /**
     * Creates a 401 Unauthorized response
     * 
     * Used when authentication is required but not provided or invalid.
     * Client should provide valid credentials and retry.
     * 
     * @param message - Error message (default: 'Unauthorized')
     * @returns 401 Unauthorized response
     * 
     * @example
     * if (!token) {
     *   return ResponseUtils.send(res, ResponseUtils.unauthorized('Token required'));
     * }
     */
    static unauthorized(message: string = 'Unauthorized'): ApiResponse {
        return this.error(message, HTTP_STATUS.UNAUTHORIZED);
    }

    /**
     * Creates a 403 Forbidden response
     * 
     * Used when user is authenticated but doesn't have permission
     * to access the requested resource.
     * Different from 401 - user is known but lacks privileges.
     * 
     * @param message - Error message (default: 'Access forbidden')
     * @returns 403 Forbidden response
     * 
     * @example
     * if (project.userId !== currentUser.id) {
     *   return ResponseUtils.send(res, ResponseUtils.forbidden('Not your project'));
     * }
     */
    static forbidden(message: string = 'Access forbidden'): ApiResponse {
        return this.error(message, HTTP_STATUS.FORBIDDEN);
    }

    /**
     * Creates a 404 Not Found response
     * 
     * Used when the requested resource does not exist.
     * Common for GET, PUT, DELETE operations on non-existent resources.
     * 
     * @param message - Error message (default: 'Resource not found')
     * @returns 404 Not Found response
     * 
     * @example
     * const user = await findUser(userId);
     * if (!user) {
     *   return ResponseUtils.send(res, ResponseUtils.notFound('User not found'));
     * }
     */
    static notFound(message: string = 'Resource not found'): ApiResponse {
        return this.error(message, HTTP_STATUS.NOT_FOUND);
    }

    /**
     * Creates a 409 Conflict response
     * 
     * Used when the request conflicts with current state of the server.
     * Common scenarios:
     * - Resource already exists (duplicate creation)
     * - Concurrent modification conflicts
     * - Business rule violations
     * 
     * @param message - Error message (default: 'Resource already exists')
     * @returns 409 Conflict response
     * 
     * @example
     * if (await emailExists(email)) {
     *   return ResponseUtils.send(res, ResponseUtils.conflict('Email already registered'));
     * }
     */
    static conflict(message: string = 'Resource already exists'): ApiResponse {
        return this.error(message, HTTP_STATUS.CONFLICT);
    }

    // ========================================================================
    // Server Error Response Helpers (5xx Status Codes)
    // ========================================================================

    /**
     * Creates a 500 Internal Server Error response
     * 
     * Used for unexpected server errors that are not the client's fault.
     * Should be used sparingly - prefer specific error responses when possible.
     * 
     * @param message - Error message (default: 'Internal Server error')
     * @returns 500 Server Error response
     * 
     * @example
     * try {
     *   await criticalOperation();
     * } catch (error) {
     *   return ResponseUtils.send(res, ResponseUtils.serverError());
     * }
     */
    static serverError(message: string = 'Internal Server error'): ApiResponse {
        return this.error(message, HTTP_STATUS.SERVER_ERROR);
    }

    // ========================================================================
    // Automatic Error Handler
    // ========================================================================

    /**
     * Automatically handles service errors and infers appropriate status codes
     * 
     * Analyzes error messages to determine the most appropriate HTTP status code.
     * This provides a convenient way to handle errors without manual status mapping.
     * 
     * Status Code Inference Rules:
     * - 400 (Bad Request): 'Validation', 'required' in message
     * - 404 (Not Found): 'not found', 'access denied' in message
     * - 409 (Conflict): 'already exists', 'duplicate' in message
     * - 500 (Server Error): Default for all other errors
     * 
     * @param error - Error object or any value thrown
     * @returns ApiResponse with inferred status code
     * 
     * @example
     * try {
     *   await createUser(userData);
     * } catch (error) {
     *   // Automatically determines if it's 400, 404, 409, or 500
     *   return ResponseUtils.send(res, ResponseUtils.handleServiceError(error));
     * }
     * 
     * @example
     * // Error with 'already exists' → returns 409
     * throw new Error('User already exists');
     * 
     * @example
     * // Error with 'not found' → returns 404
     * throw new Error('Project not found');
     */
    static handleServiceError(error: any): ApiResponse {
        let statusCode: number = HTTP_STATUS.SERVER_ERROR;
        let errorMessage: string = 'Internal server error';

        // Extract error message if it's an Error object
        if (error instanceof Error) {
            errorMessage = error.message;

            // Infer status code from error message keywords
            const message = errorMessage.toLowerCase();

            // 400 Bad Request - Validation errors
            if (message.includes('validation') || message.includes('required')) {
                statusCode = HTTP_STATUS.BAD_REQUEST;
            }
            // 404 Not Found - Resource not found or access denied
            else if (message.includes('not found') || message.includes('access denied')) {
                statusCode = HTTP_STATUS.NOT_FOUND;
            }
            // 409 Conflict - Duplicate or already exists
            else if (message.includes('already exists') || message.includes('duplicate')) {
                statusCode = HTTP_STATUS.CONFLICT;
            }
            // Default to 500 Server Error for unknown errors
        }

        return this.error(errorMessage, statusCode);
    }
}

// ============================================================================
// Usage Examples and Best Practices
// ============================================================================

/*
 * USAGE PATTERNS:
 * 
 * 1. Simple Success Response:
 * ```typescript
 * const data = await getUser(userId);
 * return ResponseUtils.send(res, ResponseUtils.success(data));
 * ```
 * 
 * 2. Create Resource:
 * ```typescript
 * const newProject = await createProject(projectData);
 * return ResponseUtils.send(res, ResponseUtils.created(newProject, 'Project created'));
 * ```
 * 
 * 3. Validation Errors:
 * ```typescript
 * const errors = validateInput(data);
 * if (errors.length > 0) {
 *   return ResponseUtils.send(res, ResponseUtils.validationError(errors));
 * }
 * ```
 * 
 * 4. Automatic Error Handling:
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   return ResponseUtils.send(res, ResponseUtils.handleServiceError(error));
 * }
 * ```
 * 
 */