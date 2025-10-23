import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './api/hello';

describe('stripe-backend api/hello', () => {
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

  it('greets with default name', async () => {
    const req = { method: 'GET', query: {} } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getBody().message).toBe('Hello World!');
  });

  it('greets with provided name', async () => {
    const req = { method: 'GET', query: { name: 'Alice' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    await handler(req, res);
    expect(res.getBody().message).toBe('Hello Alice!');
  });
});