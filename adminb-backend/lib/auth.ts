// Plain-English notes: helpers for admin authentication, tokens, and password utilities.
// These functions create and verify JWTs, hash passwords, and extract tokens from requests.
import 'dotenv/config'
import { sign as jwtSign, verify as jwtVerify, type SignOptions, type Secret, type JwtPayload } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import axios, { AxiosError } from 'axios'
import { VercelRequest } from '@vercel/node'

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'
const USER_SERVICE_BASE_URL = process.env.USER_SERVICE_BASE_URL || ''
const USER_SERVICE_VERIFY_PATH = process.env.USER_SERVICE_VERIFY_PATH || '/auth/me'
const DISABLE_AUTH = ['1', 'true', 'yes'].includes(String(process.env.DISABLE_AUTH || '').toLowerCase())
const IS_PROD = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
const IS_DEFAULT_SECRET = !process.env.JWT_SECRET
const AUTH_BYPASS = DISABLE_AUTH && !IS_PROD
const VERBOSE = ['1', 'true', 'yes'].includes(String(process.env.VERBOSE || '').toLowerCase())

const FALLBACK_VERIFY_PATHS = [
    '/api/auth/Verify',
    '/api/auth/verify',
    '/auth/me',
    '/api/user/profile'
]

// ============================================================================
// Types
// ============================================================================

export type AdminRole = 'super_admin' | 'admin' | 'viewer'

export interface AdminUser {
    id: string
    email: string
    role: AdminRole
    firstName?: string
    lastName?: string
    createdAt?: string
    metadata?: Record<string, any>
}

export interface JWTPayload extends JwtPayload {
    userId: string
    email: string
    role: AdminRole
    sessionId?: string
    iat?: number
    exp?: number
}

export interface RefreshTokenPayload extends JwtPayload {
    userId: string
    sessionId: string
    tokenVersion?: number
    iat?: number
    exp?: number
}

export interface AuthResult {
    success: boolean
    user?: AdminUser | JWTPayload
    error?: string
    errorCode?: 'NO_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'INSUFFICIENT_ROLE' | 'SERVICE_ERROR' | 'CONFIG_ERROR'
}

export interface TokenPair {
    accessToken: string
    refreshToken: string
    expiresIn: number
    refreshExpiresIn: number
}

export interface VerifyOptions {
    requiredRole?: AdminRole
    allowExpired?: boolean
}

// ============================================================================
// Logging
// ============================================================================

const log = (...args: any[]) => {
    if (VERBOSE) console.log('[auth]', ...args)
}

const logError = (...args: any[]) => {
    console.error('[auth:error]', ...args)
}

const logWarning = (...args: any[]) => {
    if (IS_PROD || VERBOSE) console.warn('[auth:warning]', ...args)
}

// Security warnings on startup
if (IS_PROD && IS_DEFAULT_SECRET) {
    logWarning('CRITICAL: Using default JWT_SECRET in production! Set JWT_SECRET environment variable.')
}
if (IS_PROD && !process.env.JWT_REFRESH_SECRET) {
    logWarning('WARNING: Using default JWT_REFRESH_SECRET in production! Set JWT_REFRESH_SECRET environment variable.')
}
if (AUTH_BYPASS) {
    logWarning('AUTH BYPASS ENABLED - Development mode only')
}

// ============================================================================
// Token Generation
// ============================================================================

// Create an access token that states who the admin is and for how long.
export function generateToken(user: AdminUser, sessionId?: string): string {
    const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId || generateSessionId()
    }

    const options: SignOptions = {
        expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn']
    }

    return jwtSign(payload, JWT_SECRET as Secret, options)
}

// Create a refresh token so clients can get a new access token later.
export function generateRefreshToken(userId: string, sessionId?: string, tokenVersion?: number): string {
    const payload: RefreshTokenPayload = {
        userId,
        sessionId: sessionId || generateSessionId(),
        tokenVersion: tokenVersion || 1
    }

    const options: SignOptions = {
        expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']
    }

    return jwtSign(payload, JWT_REFRESH_SECRET as Secret, options)
}

// Convenient helper: build both tokens at once and return their expiry in seconds.
export function generateTokenPair(user: AdminUser, sessionId?: string): TokenPair {
    const sid = sessionId || generateSessionId()
    const accessToken = generateToken(user, sid)
    const refreshToken = generateRefreshToken(user.id, sid)

    return {
        accessToken,
        refreshToken,
        expiresIn: parseExpiry(JWT_EXPIRES_IN),
        refreshExpiresIn: parseExpiry(JWT_REFRESH_EXPIRES_IN)
    }
}

// Simple unique session id used to tie tokens and requests together.
function generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Turn strings like '7d' or '30d' into seconds; used for expiry math.
function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/)
    if (!match) return 604800 // Default 7 days in seconds

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
        case 's': return value
        case 'm': return value * 60
        case 'h': return value * 3600
        case 'd': return value * 86400
        default: return 604800
    }
}

// ============================================================================
// Token Verification
// ============================================================================

// Check a JWT and optionally require a certain admin role.
export function verifyToken(token: string, options?: VerifyOptions): JWTPayload | null {
    try {
        const decoded = jwtVerify(token, JWT_SECRET as Secret, {
            ignoreExpiration: options?.allowExpired || false
        }) as JWTPayload

        if (options?.requiredRole && !hasRequiredRole(decoded.role, options.requiredRole)) {
            log('Role check failed:', decoded.role, 'required:', options.requiredRole)
            return null
        }

        return decoded
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            log('Token expired:', error.message)
        } else {
            logError('JWT verification failed:', error.message)
        }
        return null
    }
}

// Validate the refresh token used to mint a new access token.
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
        return jwtVerify(token, JWT_REFRESH_SECRET as Secret) as RefreshTokenPayload
    } catch (error: any) {
        logError('Refresh token verification failed:', error.message)
        return null
    }
}

// ============================================================================
// Password Utilities
// ============================================================================

// Turn a plain password into a secure hash to store in the database.
export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
}

// Compare a login password to the stored hash, returns true if they match.
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
}

// ============================================================================
// Request Token Extraction
// ============================================================================

// Try to find a token in headers, cookies, or query string to authenticate the request.
export function extractTokenFromRequest(req: VercelRequest): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7)
    }

    // Check cookie as fallback
    const cookieHeader = req.headers.cookie
    if (cookieHeader) {
        const match = cookieHeader.match(/auth_token=([^;]+)/)
        if (match) return match[1]
    }

    // Check query parameter (less secure, use with caution)
    if (req.query?.token && typeof req.query.token === 'string') {
        logWarning('Token passed via query parameter - not recommended for production')
        return req.query.token
    }

    return null
}

// ============================================================================
// Authentication Middleware (Synchronous)
// ============================================================================

export function verifyAdminAuth(req: VercelRequest, options?: VerifyOptions): AuthResult {
    const token = extractTokenFromRequest(req)

    if (!token) {
        if (AUTH_BYPASS) {
            log('Auth bypass: no token, using dev credentials')
            return {
                success: true,
                user: { userId: 'dev-admin', email: 'dev@example.com', role: 'super_admin' }
            }
        }
        return {
            success: false,
            error: 'No authentication token provided',
            errorCode: 'NO_TOKEN'
        }
    }

    // External verification must be async
    if (USER_SERVICE_BASE_URL) {
        return {
            success: false,
            error: 'Use verifyAdminAuthExternal or verifyAdminAuto for external verification',
            errorCode: 'CONFIG_ERROR'
        }
    }

    // Local JWT verification
    const user = verifyToken(token, options)
    if (!user) {
        if (AUTH_BYPASS) {
            log('Auth bypass: invalid token, using dev credentials')
            return {
                success: true,
                user: { userId: 'dev-admin', email: 'dev@example.com', role: 'super_admin' }
            }
        }
        return {
            success: false,
            error: 'Invalid or expired token',
            errorCode: 'INVALID_TOKEN'
        }
    }

    log('Local auth success:', user.email)
    return { success: true, user }
}

// ============================================================================
// Authentication Middleware (Async - External Service)
// ============================================================================

export async function verifyAdminAuthExternal(req: VercelRequest, options?: VerifyOptions): Promise<AuthResult> {
    const token = extractTokenFromRequest(req)

    if (!token) {
        if (AUTH_BYPASS) {
            log('Auth bypass: no token, using dev credentials')
            return {
                success: true,
                user: { id: 'dev-admin', email: 'dev@example.com', role: 'super_admin' }
            }
        }
        return {
            success: false,
            error: 'No authentication token provided',
            errorCode: 'NO_TOKEN'
        }
    }

    if (AUTH_BYPASS) {
        log('Auth bypass enabled, using dev credentials')
        return {
            success: true,
            user: { id: 'dev-admin', email: 'dev@example.com', role: 'super_admin' }
        }
    }

    if (!USER_SERVICE_BASE_URL) {
        if (IS_PROD) {
            return {
                success: false,
                error: 'USER_SERVICE_BASE_URL not configured',
                errorCode: 'CONFIG_ERROR'
            }
        }
        // Fallback to local verification in non-production
        log('No USER_SERVICE_BASE_URL, falling back to local verification')
        return verifyAdminAuth(req, options)
    }

    // Try multiple verification endpoints
    const candidates = [USER_SERVICE_VERIFY_PATH, ...FALLBACK_VERIFY_PATHS]
        .filter((p, idx, arr) => arr.indexOf(p) === idx)

    for (const path of candidates) {
        const url = `${USER_SERVICE_BASE_URL}${path}`
        try {
            log('Attempting external verification:', url)
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 5000
            })

            // Extract user from various response formats
            const user = response.data?.data?.user || response.data?.user || response.data
            if (!user || !user.id || !user.email) {
                log('Invalid user shape from', url)
                continue
            }

            // Check required role if specified
            if (options?.requiredRole && !hasRequiredRole(user.role, options.requiredRole)) {
                return {
                    success: false,
                    error: `Insufficient permissions. Required role: ${options.requiredRole}`,
                    errorCode: 'INSUFFICIENT_ROLE'
                }
            }

            log('External auth success:', user.email, 'via', url)
            return { success: true, user }
        } catch (err) {
            const axiosError = err as AxiosError
            const status = axiosError?.response?.status
            const message = (axiosError?.response?.data as any)?.message || axiosError.message || 'Token verification failed'

            // Continue trying other paths for 404 or 401
            if (status === 404 || status === 401) {
                log('Path not found or unauthorized, trying next:', url)
                continue
            }

            // For other errors, return immediately
            logError('External verification error:', message, 'at', url)
            return {
                success: false,
                error: `${message} (${url})`,
                errorCode: 'SERVICE_ERROR'
            }
        }
    }

    return {
        success: false,
        error: 'Token verification failed for all candidate paths',
        errorCode: 'INVALID_TOKEN'
    }
}

// ============================================================================
// Auto-Select Verification Mode
// ============================================================================

export async function verifyAdminAuto(req: VercelRequest, options?: VerifyOptions): Promise<AuthResult> {
    if (USER_SERVICE_BASE_URL) {
        return await verifyAdminAuthExternal(req, options)
    }

    // Local verification mode
    if (IS_PROD && IS_DEFAULT_SECRET) {
        return {
            success: false,
            error: 'JWT_SECRET must be configured in production for local verification',
            errorCode: 'CONFIG_ERROR'
        }
    }

    return verifyAdminAuth(req, options)
}

// ============================================================================
// Role-Based Access Control
// ============================================================================

const ROLE_HIERARCHY: Record<AdminRole, number> = {
    super_admin: 3,
    admin: 2,
    viewer: 1
}

export function hasRequiredRole(userRole: string, requiredRole: AdminRole): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as AdminRole] || 0
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
    return userLevel >= requiredLevel
}

export function requireRole(requiredRole: AdminRole) {
    return async (req: VercelRequest): Promise<AuthResult> => {
        return await verifyAdminAuto(req, { requiredRole })
    }
}

// ============================================================================
// Audit Logging Helper
// ============================================================================

export interface AuditLog {
    userId: string
    email: string
    action: string
    resource?: string
    metadata?: Record<string, any>
    timestamp: string
    ip?: string
    userAgent?: string
}

export function createAuditLog(
    user: AdminUser | JWTPayload,
    action: string,
    req: VercelRequest,
    resource?: string,
    metadata?: Record<string, any>
): AuditLog {
    const userId = 'userId' in user ? user.userId : user.id
    return {
        userId,
        email: user.email,
        action,
        resource,
        metadata,
        timestamp: new Date().toISOString(),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || (req.headers['x-real-ip'] as string),
        userAgent: req.headers['user-agent'] as string
    }
}

// ============================================================================
// Security Utilities
// ============================================================================

export function sanitizeUserData(user: any): Partial<AdminUser> {
    return {
        id: user.id || user.userId,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
    }
}

export function isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
    try {
        const decoded = jwtVerify(token, JWT_SECRET as Secret, { ignoreExpiration: true }) as JWTPayload
        if (!decoded.exp) return false
        const now = Math.floor(Date.now() / 1000)
        return (decoded.exp - now) < thresholdSeconds
    } catch {
        return true
    }
}

// ============================================================================
// Export Configuration (for debugging)
// ============================================================================

export const AUTH_CONFIG = {
    isProduction: IS_PROD,
    authBypass: AUTH_BYPASS,
    hasExternalService: !!USER_SERVICE_BASE_URL,
    jwtExpiresIn: JWT_EXPIRES_IN,
    refreshExpiresIn: JWT_REFRESH_EXPIRES_IN,
    usingDefaultSecret: IS_DEFAULT_SECRET
}