// POST /api/auth/login — development stub login that returns a JWT
// Do not enable in production without proper user verification.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateToken } from '../../lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, message: 'Method Not Allowed', statusCode: 405 })
  }

  // Safety checks: only allow stub login in safe environments.
const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  const hasJwtSecret = Boolean(process.env.JWT_SECRET)
  const allowStubLogin = ['1', 'true', 'yes'].includes(String(process.env.ALLOW_STUB_LOGIN || '').toLowerCase())
  if (isProd && !hasJwtSecret) {
    return res.status(500).json({ success: false, message: 'JWT_SECRET must be configured in production', statusCode: 500 })
  }
  if (isProd && !allowStubLogin) {
    return res.status(403).json({ success: false, message: 'Stub login disabled in production', statusCode: 403 })
  }

  const { email = 'admin@example.com' } = (req.body as any) || {}

  // NOTE: Stub login — replace with Supabase lookup + password verification
  const user = {
    id: 'admin-1',
    email,
    role: 'super_admin' as const,
    firstName: 'Admin',
    lastName: 'User',
    createdAt: new Date().toISOString(),
  }

  // Issue a JWT for the stubbed admin user.
const token = generateToken(user)
  return res.status(200).json({ success: true, message: 'Login successful', statusCode: 200, data: { token, user } })
}