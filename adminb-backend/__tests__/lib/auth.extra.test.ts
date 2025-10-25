import type { VercelRequest } from '@vercel/node';
import axios from 'axios';

jest.mock('axios');

describe('adminb-backend lib/auth extra coverage', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
    (axios.get as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('verifyRefreshToken succeeds and fails', async () => {
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    const auth = await import('../../lib/auth');
    const token = auth.generateRefreshToken('user-1', 'sess-1', 2);
    const decoded = auth.verifyRefreshToken(token);
    expect(decoded?.userId).toBe('user-1');
    expect(decoded?.tokenVersion).toBe(2);

    const bad = auth.verifyRefreshToken('invalid.token.here');
    expect(bad).toBeNull();
  });

  it('hashPassword and comparePassword work', async () => {
    const auth = await import('../../lib/auth');
    const hash = await auth.hashPassword('abc123');
    expect(hash).toMatch(/\$2[aby]\$/);
    expect(await auth.comparePassword('abc123', hash)).toBe(true);
    expect(await auth.comparePassword('wrong', hash)).toBe(false);
  });

  it('extractTokenFromRequest from header, cookie, query', async () => {
    const auth = await import('../../lib/auth');
    const req1 = { headers: { authorization: 'Bearer tok123' }, query: {} } as unknown as VercelRequest;
    expect(auth.extractTokenFromRequest(req1)).toBe('tok123');

    const req2 = { headers: { cookie: 'foo=bar; auth_token=cookieTok; baz=qux' }, query: {} } as unknown as VercelRequest;
    expect(auth.extractTokenFromRequest(req2)).toBe('cookieTok');

    const req3 = { headers: {}, query: { token: 'qtoken' } } as unknown as VercelRequest;
    expect(auth.extractTokenFromRequest(req3)).toBe('qtoken');
  });

  it('verifyAdminAuth handles no token without and with AUTH_BYPASS', async () => {
    process.env.DISABLE_AUTH = '0';
    const auth1 = await import('../../lib/auth');
    const res1 = auth1.verifyAdminAuth({ headers: {}, query: {} } as unknown as VercelRequest);
    expect(res1.success).toBe(false);
    expect(res1.errorCode).toBe('NO_TOKEN');

    jest.resetModules();
    process.env.DISABLE_AUTH = '1';
    delete process.env.NODE_ENV; // ensure not production
    const auth2 = await import('../../lib/auth');
    const res2 = auth2.verifyAdminAuth({ headers: {}, query: {} } as unknown as VercelRequest);
    expect(res2.success).toBe(true);
    expect((res2.user as any).role).toBe('super_admin');
  });

  it('verifyAdminAuth returns CONFIG_ERROR when USER_SERVICE_BASE_URL set', async () => {
    process.env.USER_SERVICE_BASE_URL = 'https://example.com';
    const auth = await import('../../lib/auth');
    const res = auth.verifyAdminAuth({ headers: { authorization: 'Bearer x' }, query: {} } as unknown as VercelRequest);
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('CONFIG_ERROR');
  });

  it('verifyAdminAuth with invalid token and AUTH_BYPASS true returns dev user', async () => {
    process.env.DISABLE_AUTH = '1';
    const auth = await import('../../lib/auth');
    const req = { headers: { authorization: 'Bearer invalid.token' }, query: {} } as unknown as VercelRequest;
    const res = auth.verifyAdminAuth(req);
    expect(res.success).toBe(true);
    expect((res.user as any).role).toBe('super_admin');
  });

  it('verifyAdminAuth with valid token returns user and respects requiredRole', async () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const auth = await import('../../lib/auth');
    const token = auth.generateToken({ id: 'u1', email: 'u1@example.com', role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as unknown as VercelRequest;
    const res = auth.verifyAdminAuth(req, { requiredRole: 'viewer' });
    expect(res.success).toBe(true);
    expect((res.user as any).email).toBe('u1@example.com');
    const res2 = auth.verifyAdminAuth(req, { requiredRole: 'super_admin' });
    expect(res2.success).toBe(false);
    expect(res2.errorCode).toBe('INVALID_TOKEN');
  });

  it('verifyAdminAuthExternal tries candidates and succeeds', async () => {
    process.env.DISABLE_AUTH = '1';
    process.env.NODE_ENV = 'development';
    process.env.USER_SERVICE_BASE_URL = 'https://user.service';
    process.env.USER_SERVICE_VERIFY_PATH = '/api/auth/Verify';
    (axios.get as jest.Mock)
      .mockRejectedValueOnce({ response: { status: 404 }, message: 'not found' }) // first path 404
      .mockResolvedValueOnce({ data: { user: { id: 'u2', email: 'e2@test.com', role: 'admin' } } });

    const auth = await import('../../lib/auth');
    const req = { headers: { authorization: 'Bearer tok' }, query: {} } as unknown as VercelRequest;
    const res = await auth.verifyAdminAuthExternal(req, { requiredRole: 'viewer' });
    expect(res.success).toBe(true);
    expect(typeof (res.user as any).email).toBe('string');
  });

  it('verifyAdminAuthExternal returns INSUFFICIENT_ROLE when role too low', async () => {
    process.env.DISABLE_AUTH = '0';
    process.env.NODE_ENV = 'development';
    process.env.USER_SERVICE_BASE_URL = 'https://user.service';
    process.env.USER_SERVICE_VERIFY_PATH = '/api/auth/Verify';
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'u3', email: 'e3@test.com', role: 'viewer' } } });
    const auth = await import('../../lib/auth');
    const req = { headers: { authorization: 'Bearer tok' }, query: {} } as unknown as VercelRequest;
    const res = await auth.verifyAdminAuthExternal(req, { requiredRole: 'admin' });
    expect(res.success).toBe(false);
  });

  it('verifyAdminAuthExternal returns SERVICE_ERROR for 500 error', async () => {
    process.env.USER_SERVICE_BASE_URL = 'https://user.service';
    (axios.get as jest.Mock).mockRejectedValueOnce({ response: { status: 500, data: { message: 'boom' } }, message: 'boom' });
    const auth = await import('../../lib/auth');
    const req = { headers: { authorization: 'Bearer tok' }, query: {} } as unknown as VercelRequest;
    const res = await auth.verifyAdminAuthExternal(req);
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('SERVICE_ERROR');
  });

  it('verifyAdminAuto chooses external when configured and local otherwise, with prod default secret error', async () => {
    // External path selected
    process.env.DISABLE_AUTH = '1';
    process.env.NODE_ENV = 'development';
    process.env.USER_SERVICE_BASE_URL = 'https://user.service';
    process.env.USER_SERVICE_VERIFY_PATH = '/api/auth/Verify';
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'u4', email: 'e4@test.com', role: 'admin' } } });
    let auth = await import('../../lib/auth');
    let req = { headers: { authorization: 'Bearer tok' }, query: {} } as unknown as VercelRequest;
    let res = await auth.verifyAdminAuto(req);
    expect(res.success).toBe(true);

    // Local path with production default secret error
    jest.resetModules();
    delete process.env.USER_SERVICE_BASE_URL;
    delete process.env.JWT_SECRET; // default secret
    process.env.NODE_ENV = 'production';
    auth = await import('../../lib/auth');
    req = { headers: { authorization: 'Bearer tok' }, query: {} } as unknown as VercelRequest;
    res = await auth.verifyAdminAuto(req);
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('CONFIG_ERROR');
  });

  it('hasRequiredRole mapping and requireRole wrapper', async () => {
    process.env.DISABLE_AUTH = '1';
    process.env.NODE_ENV = 'development';
    process.env.USER_SERVICE_VERIFY_PATH = '/api/auth/Verify';
    process.env.USER_SERVICE_BASE_URL = 'https://user.service';
    const auth = await import('../../lib/auth');
    expect(auth.hasRequiredRole('viewer', 'viewer')).toBe(true);
    expect(auth.hasRequiredRole('admin', 'viewer')).toBe(true);
    expect(auth.hasRequiredRole('viewer', 'admin')).toBe(false);
    const req: VercelRequest = { headers: { authorization: 'Bearer tok' } } as any;
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: { user: { id: 'u5', email: 'e5@test.com', role: 'super_admin' } } });
    const wrapper = auth.requireRole('admin');
    const result = await wrapper(req);
    expect(result.success).toBe(true);
  });

  it('createAuditLog, sanitizeUserData, isTokenExpiringSoon', async () => {
    process.env.JWT_SECRET = 'jwt-secret';
    const auth = await import('../../lib/auth');
    const token = auth.generateToken({ id: 'u6', email: 'e6@test.com', role: 'admin' }, 'sid');
    const soon = auth.isTokenExpiringSoon(token, 1000000000);
    expect(soon).toBe(true);
    const notSoonToken = auth.generateToken({ id: 'u7', email: 'e7@test.com', role: 'admin' });
    const notSoon = auth.isTokenExpiringSoon(notSoonToken, 1);
    expect(notSoon).toBe(false);
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'jest' } } as unknown as VercelRequest;
    const user = { userId: 'u6', email: 'e6@test.com', role: 'admin' } as any;
    const log = auth.createAuditLog(user, 'test-action', req, 'res1', { k: 'v' });
    expect(log.userId).toBe('u6');
    expect(log.action).toBe('test-action');
    const cleaned = auth.sanitizeUserData({ id: 'id9', email: 'e9@test.com', role: 'viewer', firstName: 'A', lastName: 'B' });
    expect(cleaned.email).toBe('e9@test.com');
    expect(cleaned.role).toBe('viewer');
  });
});