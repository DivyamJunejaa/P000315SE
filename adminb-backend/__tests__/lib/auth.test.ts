// Remove incorrect jest-circus import; use Jest globals
import { VercelRequest } from '@vercel/node';

// We will re-import the module inside tests to reflect env changes per test

describe('adminb-backend lib/auth', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('generateToken / verifyToken roundtrip and role check', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const auth = await import('../../lib/auth');
    const user = { id: 'u1', email: 'u1@example.com', role: 'admin' as const };
    const token = auth.generateToken(user);
    const decoded = auth.verifyToken(token);
    expect(decoded?.email).toBe('u1@example.com');
    expect(auth.hasRequiredRole(decoded!.role, 'viewer')).toBe(true);
    expect(auth.hasRequiredRole(decoded!.role, 'super_admin')).toBe(false);
  });

  it('generateTokenPair includes both tokens and expiries', async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    const auth = await import('../../lib/auth');
    const pair = auth.generateTokenPair({ id: 'u2', email: 'e2@test.com', role: 'viewer' });
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(pair.expiresIn).toBeGreaterThan(0);
    expect(pair.refreshExpiresIn).toBeGreaterThan(0);
  });

  it('extractTokenFromRequest reads Bearer header', async () => {
    const auth = await import('../../lib/auth');
    const req = { headers: { authorization: 'Bearer abc123' } } as unknown as VercelRequest;
    expect(auth.extractTokenFromRequest(req)).toBe('abc123');
  });

  it('verifyAdminAuth returns NO_TOKEN without bypass', async () => {
    process.env.DISABLE_AUTH = '0';
    const auth = await import('../../lib/auth');
    const req = { headers: {} } as unknown as VercelRequest;
    const res = auth.verifyAdminAuth(req);
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('NO_TOKEN');
  });

  it('verifyAdminAuth bypass when DISABLE_AUTH in dev', async () => {
    process.env.DISABLE_AUTH = '1';
    process.env.NODE_ENV = 'development';
    const auth = await import('../../lib/auth');
    const req = { headers: {} } as unknown as VercelRequest;
    const res = auth.verifyAdminAuth(req);
    expect(res.success).toBe(true);
    expect((res.user as any).email).toBe('dev@example.com');
  });

  it('verifyAdminAuto falls back to local verify when no USER_SERVICE_BASE_URL', async () => {
    process.env.JWT_SECRET = 'local-secret';
    const auth = await import('../../lib/auth');
    const token = auth.generateToken({ id: 'a', email: 'a@x.com', role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as VercelRequest;
    const res = await auth.verifyAdminAuto(req);
    expect(res.success).toBe(true);
    expect((res.user as any).email).toBe('a@x.com');
  });

  it('createAuditLog generates proper fields', async () => {
    const auth = await import('../../lib/auth');
    const req = { headers: { 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4' } } as unknown as VercelRequest;
    const user = { userId: 'u', email: 'e@x.com', role: 'admin' };
    const log = auth.createAuditLog(user as any, 'test', req);
    expect(log.userId).toBe('u');
    expect(log.email).toBe('e@x.com');
    expect(log.action).toBe('test');
    expect(log.userAgent).toBe('UA');
  });

  it('isTokenExpiringSoon detects soon-to-expire tokens', async () => {
    process.env.JWT_SECRET = 'secret';
    const auth = await import('../../lib/auth');
    const token = auth.generateToken({ id: 'a', email: 'a@x.com', role: 'admin' }, 'sid');
    const soon = auth.isTokenExpiringSoon(token, 10000000); // huge threshold
    expect(soon).toBe(true);
  });
});