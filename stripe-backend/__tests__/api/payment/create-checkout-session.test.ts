import type { VercelRequest, VercelResponse } from '@vercel/node';

function makeRes() {
  const body: any = {};
  let statusCode: number | null = null;
  let ended = false;
  return {
    setHeader: (_k: string, _v: string) => {},
    status: (code: number) => ({ json: (b: any) => { statusCode = code; Object.assign(body, b); return b; }, end: () => { statusCode = code; ended = true; } }),
    json: (b: any) => { Object.assign(body, b); },
    end: () => { ended = true; },
    getStatus: () => statusCode,
    getBody: () => body,
    getEnded: () => ended,
  } as unknown as VercelResponse;
}

describe('stripe-backend api/payment/create-checkout-session', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (process.env as any).STRIPE_SECRET_KEY;
    delete (process.env as any).FRONTEND_ORIGIN;
    delete (process.env as any).ALLOWED_ORIGINS;
  });

  it('returns 405 for non-POST', async () => {
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    let handler: any;
    try {
      handler = require('../../../api/payment/create-checkout-session').default;
    } catch (e: any) {
      console.error('Require handler failed:', e?.message || e);
      console.error('Stack:', e?.stack);
      throw new Error('Require handler failed: ' + (e?.stack || e?.message || e));
    }
    const req = { method: 'GET', headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(405);
    expect(res.getBody().success).toBe(false);
  });

  it('returns 500 when STRIPE_SECRET_KEY is missing', async () => {
    jest.doMock('stripe', () => { 
      class FakeStripe {};
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/create-checkout-session').default;
    const req = { method: 'POST', body: { price_id: 'price_123', user_id: 'u1' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(500);
    expect(res.getBody().message).toMatch(/Missing STRIPE_SECRET_KEY/i);
  });

  it('returns 400 when price_id or user_id missing', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    jest.doMock('stripe', () => {
      class FakeStripe { 
        constructor(...args: any[]) { console.log('FakeStripe constructed', args); }
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/create-checkout-session').default;
    const req = { method: 'POST', body: { user_id: 'u1' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(400);
    expect(res.getBody().message).toMatch(/Price ID and User ID are required/i);
  });

  it('redirects to Billing Portal when existing paid subscription detected', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    (process.env as any).FRONTEND_ORIGIN = 'http://localhost:3000';
    jest.doMock('stripe', () => { 
      class FakeStripe {
        customers = {
          search: async (_q: any) => ({ data: [{ id: 'cus_123', email: 'e@x.com' }] }),
          list: async (_p: any) => ({ data: [] }),
          create: async (_p: any) => ({ id: 'cus_123', email: 'e@x.com' }),
          retrieve: async (_id: string) => ({ id: 'cus_123', email: 'e@x.com', metadata: { user_id: 'u1' } }),
          update: async (_id: string, _p: any) => ({})
        } as any;
        subscriptions = {
          list: async (p: any) => {
            if (p.status === 'active') {
              return { data: [{ id: 'sub_paid', items: { data: [{ price: { id: 'price_paid', unit_amount: 1000 } }] } }] };
            }
            return { data: [] };
          }
        } as any;
        billingPortal = {
          sessions: {
            create: async (_p: any) => ({ url: 'https://portal.example.com' })
          }
        } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    let handler: any;
    try {
      handler = require('../../../api/payment/create-checkout-session').default;
    } catch (e: any) {
      console.error('Require handler failed:', e?.message || e);
      console.error('Stack:', e?.stack);
      throw new Error('Require handler failed: ' + (e?.stack || e?.message || e));
    }
    const req = { method: 'POST', body: { price_id: 'price_pro', user_id: 'u1', email: 'e@x.com' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().url).toMatch(/portal/);
    expect(res.getBody().message).toMatch(/redirecting to Billing Portal/i);
  });

  it('creates Checkout session when free-tier subscription detected', async () => {
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    (process.env as any).FRONTEND_ORIGIN = 'http://localhost:3000';
    jest.doMock('stripe', () => { 
      class FakeStripe {
        customers = {
          search: async (_q: any) => ({ data: [{ id: 'cus_123', email: 'e@x.com' }] }),
          list: async (_p: any) => ({ data: [] }),
          create: async (_p: any) => ({ id: 'cus_123', email: 'e@x.com' }),
          retrieve: async (_id: string) => ({ id: 'cus_123', email: 'e@x.com', metadata: { user_id: 'u1' } }),
          update: async (_id: string, _p: any) => ({})
        } as any;
        subscriptions = {
          list: async (p: any) => {
            // Return free-tier subscription for active to proceed to Checkout
            if (p.status === 'active') {
              return { data: [{ id: 'sub_free', items: { data: [{ price: { id: 'price_free', unit_amount: 0 } }] } }] };
            }
            return { data: [] };
          }
        } as any;
        checkout = {
          sessions: {
            create: async (_p: any, _opts: any) => ({ id: 'cs_123', url: 'https://checkout.example.com', success_url: 'http://localhost:3000/subscription-success?session_id={CHECKOUT_SESSION_ID}', cancel_url: 'http://localhost:3000/plans?status=cancelled', customer: 'cus_123' })
          }
        } as any;
        billingPortal = { sessions: { create: async (_p: any) => ({ url: 'https://portal.example.com' }) } } as any;
      }
      return { __esModule: true, default: FakeStripe } as any;
    });
    const handler = require('../../../api/payment/create-checkout-session').default;
    const req = { method: 'POST', body: { price_id: 'price_pro', user_id: 'u1', email: 'e@x.com' }, headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().url).toMatch(/checkout/);
    expect(res.getBody().message).toMatch(/Checkout session created/i);
  });
});