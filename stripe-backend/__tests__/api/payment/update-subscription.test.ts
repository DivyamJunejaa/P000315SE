import type { VercelRequest, VercelResponse } from '@vercel/node';

function makeRes() {
  const body: any = {};
  let statusCode: number | null = null;
  return {
    setHeader: (_k: string, _v: string) => {},
    status: (code: number) => ({ json: (b: any) => { statusCode = code; Object.assign(body, b); return b; } }),
    json: (b: any) => { Object.assign(body, b); },
    getStatus: () => statusCode,
    getBody: () => body,
  } as unknown as VercelResponse;
}

describe('stripe-backend api/payment/update-subscription', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (process.env as any).STRIPE_SECRET_KEY;
  });

  it('returns 405 for non-POST', async () => {
    const handler = require('../../../api/payment/update-subscription').default;
    const req = { method: 'GET', headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(405);
  });

  it('returns 500 when STRIPE_SECRET_KEY missing', async () => {
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/update-subscription').default;
    const req = { method: 'POST', body: { session_id: 'cs_123' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(500);
    expect(res.getBody().message).toMatch(/Missing STRIPE_SECRET_KEY/i);
  });

  it('returns 400 when neither subscription_id nor session_id provided', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/update-subscription').default;
    const req = { method: 'POST', body: {}, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
  });

  it('syncs subscription using session_id and returns normalized data', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => {
      class FakeStripe {
        checkout = { sessions: { retrieve: jest.fn().mockResolvedValue({ id: 'cs_123', subscription: 'sub_123', customer: 'cus_123' }) } } as any;
        subscriptions = { 
          retrieve: jest.fn().mockResolvedValue({ 
            id: 'sub_123', 
            status: 'active', 
            start_date: Math.floor(Date.now()/1000) - 86400,
            current_period_end: Math.floor(Date.now()/1000) + 86400,
            items: { data: [ { price: { id: 'price_pro' } } ] },
            metadata: { user_id: 'u1' }
          }),
          update: jest.fn().mockResolvedValue({})
        } as any;
        customers = { retrieve: jest.fn().mockResolvedValue({ id: 'cus_123', email: 'user@example.com' }) } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/update-subscription').default;
    const req = { method: 'POST', body: { session_id: 'cs_123', user_id: 'u1' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    const data = res.getBody().data;
    expect(data.subscriptionId).toBe('sub_123');
    expect(data.email).toBe('user@example.com');
    expect(data.planId).toBe('price_pro');
    expect(res.getBody().message).toMatch(/Subscription synced from Stripe/i);
  });
});