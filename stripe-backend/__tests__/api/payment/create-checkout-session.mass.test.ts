import type { VercelRequest, VercelResponse } from '@vercel/node';

jest.setTimeout(30000);

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

describe('stripe-backend api/payment/create-checkout-session mass normalization tests', () => {
  const origins = [
    undefined,
    'http://localhost:3000',
    'http://localhost:5173',
    'https://site.example',
    'http://127.0.0.1:5173'
  ];
  const successVariants = [
    undefined,
    '/subscription-success',
    'http://backend.local/api/payment/success',
    'https://another.site/path?param=1',
    '/subscription-success?session_id={CHECKOUT_SESSION_ID}'
  ];
  const cancelVariants = [
    undefined,
    '/plans?status=cancelled',
    'http://backend.local/api/payment/cancel',
    'https://another.site/cancel',
    '/plans?cancelled=1'
  ];

  beforeEach(() => {
    jest.resetModules();
    // Silence logs to avoid overwhelming output buffers
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (process.env as any).STRIPE_SECRET_KEY = 'sk_test_123';
    (process.env as any).FRONTEND_ORIGIN = 'http://localhost:5173';
    delete (process.env as any).ALLOWED_ORIGINS;
  });

  it.each(origins.flatMap(o => successVariants.flatMap(su => cancelVariants.map(cu => [o, su, cu]))))(
    'normalizes success/cancel URLs for origin=%s success=%s cancel=%s',
    async (origin, success_url, cancel_url) => {
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
            list: async (_p: any) => ({ data: [] })
          } as any;
          billingPortal = { sessions: { create: async (_p: any) => ({ url: 'https://portal.example.com' }) } } as any;
          checkout = {
            sessions: {
              create: async (params: any, _opts: any) => ({ id: 'cs_123', url: 'https://checkout.example.com', success_url: params.success_url, cancel_url: params.cancel_url, customer: params.customer })
            }
          } as any;
        }
        return { __esModule: true, default: FakeStripe } as any;
      });

      const handler = require('../../../api/payment/create-checkout-session').default;
      const req = { method: 'POST', body: { price_id: 'price_pro', user_id: 'u1', email: 'e@x.com', success_url, cancel_url }, headers: { origin } } as unknown as VercelRequest;
      const res = makeRes() as any;
      await handler(req, res);

      expect(res.getStatus()).toBe(200);
      const payload = res.getBody();
      expect(typeof payload.effective_success_url).toBe('string');
      expect(typeof payload.effective_cancel_url).toBe('string');
      // Must point to resolved frontend origin: prefer request origin, else env
      const FRONTEND = (process.env as any).FRONTEND_ORIGIN;
      const expectedOrigin = origin && origin !== 'http://localhost:3001' ? origin : FRONTEND;
      expect(payload.effective_success_url.startsWith(expectedOrigin)).toBe(true);
      expect(payload.effective_cancel_url.startsWith(expectedOrigin)).toBe(true);
    }
  );
});