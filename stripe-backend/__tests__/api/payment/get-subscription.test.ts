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

describe('stripe-backend api/payment/get-subscription', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (process.env as any).STRIPE_SECRET_KEY;
  });

  it('returns 500 when STRIPE_SECRET_KEY missing', async () => {
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/get-subscription').default;
    const req = { method: 'GET', query: { subscription_id: 'sub_123' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
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
    const handler = require('../../../api/payment/get-subscription').default;
    const req = { method: 'GET', query: {}, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
  });

  it('resolves subscription via session_id and returns minimal fields', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => {
      class FakeStripe {
        checkout = { sessions: { retrieve: jest.fn().mockResolvedValue({ subscription: 'sub_123' }) } } as any;
        subscriptions = {
          retrieve: jest.fn().mockResolvedValue({
            id: 'sub_123',
            status: 'active',
            items: { data: [{ price: { id: 'price_pro', recurring: { interval: 'monthly' }, unit_amount: 2000 } }] },
            current_period_end: Math.floor(Date.now()/1000),
            current_period_start: Math.floor(Date.now()/1000) - 86400,
          })
        } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/get-subscription').default;
    const req = { method: 'GET', query: { session_id: 'cs_123' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    const data = res.getBody().data;
    expect(data.subscriptionId).toBe('sub_123');
    expect(data.planId).toBe('price_pro');
    expect(data.interval).toBe('monthly');
    expect(data.amount).toBe(2000);
  });
});