import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = require('../../api/health').default;

describe('stripe-backend api/health', () => {
  function makeRes() {
    const body: any = {};
    let statusCode: number | null = null;
    return {
      status: (code: number) => ({ json: (b: any) => { statusCode = code; Object.assign(body, b); return b; } }),
      json: (b: any) => { Object.assign(body, b); },
      getStatus: () => statusCode,
      getBody: () => body,
      setHeader: () => {}
    } as unknown as VercelResponse;
  }

  it('returns 200 and message', async () => {
    const req = { method: 'GET' } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getBody().message).toMatch(/server is running/i);
  });
});