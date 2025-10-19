/// <reference path="./types/stripe.d.ts" />
import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildReqRes(query: Record<string, any> = {}) {
  const req = { method: 'GET', query, headers: {} } as unknown as VercelRequest;
  let statusCode = 0;
  let jsonBody: any = null;
  const res = {
    setHeader: (_k: string, _v: string) => {},
    status: (code: number) => {
      statusCode = code;
      return { json: (obj: any) => { jsonBody = obj; } } as any;
    }
  } as unknown as VercelResponse;
  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

describe('adminb-backend/api/dashboard', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../lib/auth', () => ({
      verifyAdminAuto: jest.fn().mockResolvedValue({ success: true, user: { id: 'admin' } })
    }));
    jest.doMock('../lib/cors', () => ({
      withCors: (fn: any) => fn
    }));
  });

  test('returns demo payload when STRIPE_SECRET_KEY is missing', async () => {
    delete (process.env as any).STRIPE_SECRET_KEY;
    const dashboard = (await import('../api/dashboard')).default;
    const { req, res, getStatus, getBody } = buildReqRes();
    await dashboard(req, res);
    const body = getBody();
    expect(getStatus()).toBe(200);
    expect(body?.success).toBe(true);
    expect(String(body?.message || '')).toMatch(/Demo dashboard/i);
    expect(body?.data?.overview?.proCustomers).toBeDefined();
    expect(body?.data?.overview?.premiumCustomers).toBeDefined();
  });

  test('counts Pro/Premium only for active subscriptions via price/product match', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_123';
    process.env.STRIPE_PREMIUM_PRODUCT_ID = 'prod_prem_456';

    const { setStripeMockState } = await import('stripe');

    setStripeMockState({
      subsAll: [
        { id: 's_pro_active', status: 'active',
          items: { data: [ { price: { id: 'price_pro_123', product: 'prod_any', unit_amount: 1000, recurring: { interval: 'month' } } } ] } },
        { id: 's_prem_active', status: 'active',
          items: { data: [ { price: { id: 'price_other', product: 'prod_prem_456', unit_amount: 2900, recurring: { interval: 'month' } } } ] } },
        { id: 's_prem_trial', status: 'trialing',
          items: { data: [ { price: { id: 'price_other', product: 'prod_prem_456', unit_amount: 2900 } } ] } },
        { id: 's_other_active', status: 'active',
          items: { data: [ { price: { id: 'price_xyz', product: 'prod_xyz', unit_amount: 1500, recurring: { interval: 'month' } } } ] } },
        { id: 's_pro_canceled', status: 'canceled',
          items: { data: [ { price: { id: 'price_pro_123', product: 'prod_any', unit_amount: 1000 } } ] } },
      ],
      invoicesPaid: [ { total: 1000 }, { total: 1500 } ],
      recentSubs: [
        { id: 'recent_pro', status: 'active',
          items: { data: [ { price: { id: 'price_pro_123', product: 'prod_any', unit_amount: 1000, recurring: { interval: 'month' } } } ] },
          customer: { name: 'Alice Pro', email: 'alice@example.com' } },
        { id: 'recent_premium', status: 'active',
          items: { data: [ { price: { id: 'price_other', product: 'prod_prem_456', unit_amount: 2900, recurring: { interval: 'month' } } } ] },
          customer: { name: 'Bob Premium', email: 'bob@example.com' } },
        { id: 'recent_other', status: 'active',
          items: { data: [ { price: { id: 'price_xyz', product: 'prod_xyz', unit_amount: 500, recurring: { interval: 'month' } } } ] },
          customer: { name: 'Charlie Other', email: 'charlie@example.com' } }
      ]
    });

    const dashboard = (await import('../api/dashboard')).default;
    const { req, res, getStatus, getBody } = buildReqRes();
    await dashboard(req, res);
    const body = getBody();

    expect(getStatus()).toBe(200);
    expect(body?.success).toBe(true);

    const overview = body?.data?.overview;
    expect(overview?.subscriptions?.total).toBe(5);
    expect(overview?.subscriptions?.active).toBe(3);
    expect(overview?.subscriptions?.trialing).toBe(1);
    expect(overview?.subscriptions?.canceled).toBe(1);

    expect(overview?.proCustomers?.total).toBe(1);
    expect(overview?.premiumCustomers?.total).toBe(1);

    expect(overview?.revenue?.amountCents).toBe(2500);
    expect(overview?.revenue?.count).toBe(2);

    const tiers = (body?.data?.recentSubscriptions || []).map((r: any) => r.tier);
    expect(tiers).toContain('Pro');
    expect(tiers).toContain('Premium');
    expect(tiers).toContain('Other');
  });
});