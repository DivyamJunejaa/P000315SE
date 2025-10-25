import { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

/**
 * High-volume parameterized tests for adminb-backend auth utilities
 * Targets: generateTokenPair, hasRequiredRole, extractTokenFromRequest, isTokenExpiringSoon
 */

describe('adminb-backend lib/auth mass parameterized tests', () => {
  const SECRET = 'mass-test-secret';
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
    process.env.JWT_SECRET = SECRET;
    process.env.JWT_REFRESH_SECRET = SECRET + '-refresh';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const expiryExprs = [
    '1s','2s','5s','10s','30s','60s','90s','120s',
    '1m','2m','5m','10m','15m','20m','30m','45m','60m',
    '1h','2h','3h','4h','6h','8h','12h','18h','24h',
    '1d','2d','3d','5d','7d','10d','14d','21d','30d'
  ];

  it.each(expiryExprs)('generateTokenPair returns tokens and expiries for %s', async (exp) => {
    process.env.JWT_EXPIRES_IN = exp;
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    const auth = await import('../../lib/auth');
    const pair = auth.generateTokenPair({ id: 'u', email: 'e@test.com', role: 'admin' });
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');
    expect(typeof pair.expiresIn).toBe('number');
    expect(typeof pair.refreshExpiresIn).toBe('number');
    expect(pair.expiresIn).toBeGreaterThan(0);
    expect(pair.refreshExpiresIn).toBeGreaterThan(0);
  });

  const roles = ['viewer','admin','super_admin'] as const;
  const required = ['viewer','admin','super_admin'] as const;
  it.each(roles.flatMap(r => required.map(rr => [r, rr])))('hasRequiredRole %s >= %s behaves correctly', async (userRole, reqRole) => {
    const auth = await import('../../lib/auth');
    const ok = auth.hasRequiredRole(userRole, reqRole);
    const hierarchy: Record<string, number> = { viewer: 1, admin: 2, super_admin: 3 };
    expect(ok).toBe(hierarchy[userRole] >= hierarchy[reqRole]);
  });

  it.each([
    { headers: { authorization: 'Bearer tok-1' }, cookie: '', query: {} },
    { headers: { authorization: 'Bearer tok-2' }, query: {} },
    { headers: { cookie: 'auth_token=cookieTok1' }, query: {} },
    { headers: { cookie: 'x=y; auth_token=cookieTok2; z=w' }, query: {} },
    { headers: { }, query: { token: 'qTok-1' } },
    { headers: { }, query: { token: 'qTok-2' } },
    // Mixed cases
    { headers: { authorization: 'Bearer headerWins', cookie: 'auth_token=cookieShouldNotWin' }, query: { token: 'qTokIgnored' } },
    { headers: { cookie: 'auth_token=cookieWins' }, query: { token: 'qTokIgnored' } },
    { headers: { }, query: { token: 'qTokOnly' } },
    { headers: { authorization: 'Bearer spaced token ' }, query: {} },
  ])('extractTokenFromRequest handles headers/cookies/query combinations', async (payload) => {
    const auth = await import('../../lib/auth');
    const req = { headers: payload.headers, query: payload.query } as unknown as VercelRequest;
    const tok = auth.extractTokenFromRequest(req);
    if (payload.headers.authorization && String(payload.headers.authorization).startsWith('Bearer ')) {
      expect(tok).toBe(String(payload.headers.authorization).substring(7));
    } else if (payload.headers.cookie && /auth_token=([^;]+)/.test(String(payload.headers.cookie))) {
      expect(tok).toMatch(/cookieTok|cookieWins/);
    } else if (payload.query && typeof payload.query.token === 'string') {
      expect(tok).toBe(payload.query.token);
    } else {
      expect(tok === null || typeof tok === 'string').toBe(true);
    }
  });

  // Build many expiration scenarios for isTokenExpiringSoon
  const thresholds = [1, 5, 10, 20, 30, 60, 120, 300, 600, 900];
  it.each([10, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200].flatMap(o => thresholds.map(t => [o, t])))('isTokenExpiringSoon works for exp offset %s and threshold %s', async (offset, threshold) => {
    const auth = await import('../../lib/auth');
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign({ userId: 'u', email: 'e@test', role: 'admin', exp: now + offset }, SECRET);
    const soon = auth.isTokenExpiringSoon(token, threshold);
    expect(typeof soon).toBe('boolean');
    // Basic consistency: smaller offset than threshold should be treated as expiring soon
    expect(soon).toBe(offset < threshold);
  });
});