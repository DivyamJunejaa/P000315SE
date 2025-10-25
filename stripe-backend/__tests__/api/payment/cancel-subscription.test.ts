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

describe('stripe-backend api/payment/cancel-subscription', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (process.env as any).STRIPE_SECRET_KEY;
  });

  it('returns 405 for non-POST', async () => {
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/cancel-subscription').default;
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
    const handler = require('../../../api/payment/cancel-subscription').default;
    const req = { method: 'POST', body: { user_id: 'u1' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(500);
  });

  it('returns 400 when user_id missing', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/cancel-subscription').default;
    const req = { method: 'POST', body: {}, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
    expect(res.getBody().message).toMatch(/User ID is required/i);
  });

  it('cancels subscription when provided cs_ session id', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => {
      class FakeStripe {
        checkout = { sessions: { retrieve: jest.fn().mockResolvedValue({ subscription: 'sub_123' }) } } as any;
        subscriptions = {
          retrieve: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'active', customer: 'cust_1' }),
          cancel: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'canceled', canceled_at: Math.floor(Date.now()/1000), customer: 'cust_1' })
        } as any;
        customers = { retrieve: jest.fn().mockResolvedValue({ id: 'cust_1', metadata: {} }), update: jest.fn().mockResolvedValue({}) } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/cancel-subscription').default;
    const req = { method: 'POST', body: { user_id: 'u1', subscription_id: 'cs_123' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toMatch(/Subscription canceled successfully/i);
    expect(res.getBody().data.subscription_id).toBe('sub_123');
  });

  it('returns already canceled when status is canceled', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => {
      class FakeStripe {
        checkout = { sessions: { retrieve: jest.fn().mockResolvedValue({ subscription: 'sub_123' }) } } as any;
        subscriptions = {
          retrieve: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'canceled', canceled_at: Math.floor(Date.now()/1000) }),
          cancel: jest.fn()
        } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/cancel-subscription').default;
    const req = { method: 'POST', body: { user_id: 'u1', subscription_id: 'cs_123' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().data.already_canceled).toBe(true);
  });
});