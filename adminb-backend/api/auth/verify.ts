// GET /api/auth/verify — verifies current admin token and returns user info
// Uses external service or local JWT depending on configuration.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdminAuto } from '../../lib/auth'

// Handler: only accepts GET and returns the current admin user if valid.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, message: 'Method Not Allowed', statusCode: 405 })
  }

  const auth = await verifyAdminAuto(req)
  if (!auth.success || !auth.user) {
    return res.status(401).json({ success: false, message: auth.error || 'Unauthorized', statusCode: 401 })
  }

  return res.status(200).json({ success: true, statusCode: 200, data: { user: auth.user }, message: 'Verified' })
}