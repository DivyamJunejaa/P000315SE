// Simple CORS helpers: set headers, handle preflight, and block disallowed origins.
import { VercelRequest, VercelResponse } from '@vercel/node'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void

// ============================================================================
// CORS Configuration
// ============================================================================

interface CorsOptions {
    origin: string[]
    methods: string[]
    allowedHeaders: string[]
    credentials: boolean
    maxAge: number
}

// Get allowed origins from environment or use defaults
function getAllowedOrigins(): string[] {
    const envOrigins = process.env.ALLOWED_ORIGINS
    if (envOrigins) {
        return envOrigins.split(',').map(o => o.trim()).filter(Boolean)
    }

    // Default origins
    return [
        'http://localhost:5173',      // Vite dev server
        'http://localhost:5174',      // Vite dev server (alternate port)
        'http://localhost:3000',      // React dev server
        'https://qfo-admin.vercel.app',         // Legacy production admin frontend
        'https://qfo-admin-*.vercel.app',       // Legacy preview deployments (wildcard)
        'https://toc-adminfrontend.vercel.app', // Current production admin frontend
        'https://toc-adminfrontend-*.vercel.app', // Current preview deployments (wildcard)
    ]
}

const CORS_OPTIONS: CorsOptions = {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
}

// ============================================================================
// Origin Validation
// ============================================================================

function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return false

    return CORS_OPTIONS.origin.some(allowedOrigin => {
        // Exact match
        if (allowedOrigin === origin) return true

        // Wildcard pattern matching
        if (allowedOrigin.includes('*')) {
            const pattern = allowedOrigin
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
                .replace(/\*/g, '.*') // Convert * to .*
            const regex = new RegExp(`^${pattern}$`)
            return regex.test(origin)
        }

        return false
    })
}

// ============================================================================
// Apply CORS Headers
// ============================================================================

// Core function: apply CORS headers and short-circuit OPTIONS preflight.
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
    const origin = req.headers.origin

    // Set appropriate origin header
    if (origin && isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
    } else if (!CORS_OPTIONS.credentials) {
        // Only use '*' if credentials are not required
        res.setHeader('Access-Control-Allow-Origin', '*')
    }
    // If origin is not allowed and credentials are true, don't set the header
    // This will cause the browser to block the request

    // Set other CORS headers
    res.setHeader('Access-Control-Allow-Methods', CORS_OPTIONS.methods.join(', '))
    res.setHeader('Access-Control-Allow-Headers', CORS_OPTIONS.allowedHeaders.join(', '))

    if (CORS_OPTIONS.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    res.setHeader('Access-Control-Max-Age', CORS_OPTIONS.maxAge.toString())

    // Handle preflight (OPTIONS) requests
    if (req.method === 'OPTIONS') {
        res.status(204).end()
        return true // Indicates preflight was handled
    }

    return false // Continue with normal request processing
}

// ============================================================================
// CORS Middleware Wrapper
// ============================================================================

// Wrapper: run CORS first; if not preflight, pass to the actual handler.
export function withCors(handler: Handler) {
    return async (req: VercelRequest, res: VercelResponse) => {
        const preflightHandled = applyCors(req, res)

        // If preflight was handled, don't call the handler
        if (preflightHandled) {
            return
        }

        // Origin validation for non-preflight requests
        const origin = req.headers.origin
        if (CORS_OPTIONS.credentials && origin && !isOriginAllowed(origin)) {
            res.status(403).json({
                success: false,
                message: 'CORS: Origin not allowed',
                statusCode: 403
            })
            return
        }

        // Call the actual handler
        try {
            await handler(req, res)
        } catch (error: any) {
            console.error('Handler error:', error)

            // Only send error response if headers haven't been sent yet
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: error.message || 'Internal server error',
                    statusCode: 500
                })
            }
        }
    }
}

// ============================================================================
// Development Helper
// ============================================================================

// Dev helper: loosen CORS completely for quick testing and local tools.
export function allowAllOrigins() {
    return (req: VercelRequest, res: VercelResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', CORS_OPTIONS.methods.join(', '))
        res.setHeader('Access-Control-Allow-Headers', CORS_OPTIONS.allowedHeaders.join(', '))

        if (req.method === 'OPTIONS') {
            res.status(204).end()
            return true
        }
        return false
    }
}

// ============================================================================
// Export Configuration (for debugging)
// ============================================================================

export const CORS_CONFIG = {
    allowedOrigins: CORS_OPTIONS.origin,
    methods: CORS_OPTIONS.methods,
    credentials: CORS_OPTIONS.credentials,
    maxAge: CORS_OPTIONS.maxAge
}