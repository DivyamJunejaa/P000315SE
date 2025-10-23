import type { VercelRequest, VercelResponse } from '@vercel/node';

jest.mock('../../lib/auth', () => ({
  verifyAdminAuto: jest.fn(async () => ({ success: true, user: { id: 'a', email: 'a@x.com', role: 'admin' } }))
}));

describe('admin-backend api/dashboard', () => {
  const handler = require('../../api/dashboard').default;

  function makeRes() {
    const body: any = {};
    let statusCode: number | null = null;
    const headers: Record<string, string> = {};
    return {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status: (code: number) => ({ json: (b: any) => { statusCode = code; Object.assign(body, b); return b; } }),
      json: (b: any) => { Object.assign(body, b); },
      getStatus: () => statusCode,
      getBody: () => body,
      headers,
    } as any;
  }

  it('rejects non-GET methods', async () => {
    const req = { method: 'POST', query: {}, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(405);
  });

  it('returns quick stub payload when quick=1 and no stripe key', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const req = { method: 'GET', query: { quick: '1' }, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().data?.overview?.revenue?.period).toBe('month');
  });

  it('returns demo payload if STRIPE_SECRET_KEY missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const req = { method: 'GET', query: {}, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toContain('Demo dashboard');
  });

  it('returns 401 when auth fails', async () => {
    const auth = require('../../lib/auth');
    (auth.verifyAdminAuto as jest.Mock).mockResolvedValueOnce({ success: false, error: 'nope' });
    const req = { method: 'GET', query: {}, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(401);
    expect(res.getBody().message).toBe('nope');
  });

  it('aggregates from Stripe when STRIPE_SECRET_KEY set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRO_PRICE_ID = 'price_PRO';
    process.env.STRIPE_PREMIUM_PRODUCT_ID = 'prod_PREM';

    jest.resetModules();
    jest.doMock('stripe', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => {
        const subsPages = [
          {
            data: [
              { id: 's1', status: 'active', items: { data: [{ price: { id: 'price_PRO', product: 'prodX', unit_amount: 2500, recurring: { interval: 'month' } } }] }, customer: { name: 'Alice', email: 'alice@test.com' } },
              { id: 's2', status: 'trialing', items: { data: [{ price: { id: 'priceY', product: { id: 'prod_PREM' }, unit_amount: 2900, recurring: { interval: 'month' } } }] }, customer: { name: 'Bob', email: 'bob@test.com' } },
              { id: 's3', status: 'canceled', items: { data: [{ price: { id: 'priceZ', product: 'prodZ', unit_amount: 9900, recurring: { interval: 'year' } } }] }, customer: { name: 'Carol', email: 'carol@test.com' } },
            ],
            has_more: false
          }
        ];

        const invPages = [
          { data: [{ total: 1200 }, { total: 3400 }], has_more: false },
        ];

        return {
          subscriptions: {
            list: jest.fn().mockImplementation((opts: any) => {
              if (opts && opts.limit === 10) {
                return { data: subsPages[0].data, has_more: false };
              }
              return subsPages[0];
            })
          },
          invoices: {
            list: jest.fn().mockImplementation((_opts: any) => invPages[0])
          }
        };
      })
    }));

    const handlerReloaded = require('../../api/dashboard').default;
    const req = { method: 'GET', query: {}, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handlerReloaded(req, res);

    expect(res.getStatus()).toBe(200);
    const body = res.getBody();
    expect(body.success).toBe(true);
    expect(body.data?.overview?.subscriptions?.total).toBeGreaterThanOrEqual(1);
    expect(typeof body.data?.overview?.revenue?.amountCents).toBe('number');
    expect(Array.isArray(body.data?.charts?.revenueTrend)).toBe(true);
    expect(Array.isArray(body.data?.recentSubscriptions)).toBe(true);
  });

  it('handles Stripe aggregation errors with 500 response', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    jest.resetModules();
    jest.doMock('stripe', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        subscriptions: { list: jest.fn().mockRejectedValue(new Error('boom')) },
        invoices: { list: jest.fn().mockResolvedValue({ data: [], has_more: false }) }
      }))
    }));

    const handlerReloaded = require('../../api/dashboard').default;
    const req = { method: 'GET', query: {}, headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handlerReloaded(req, res);
    expect(res.getStatus()).toBe(500);
    expect(res.getBody().success).toBe(false);
  });
});