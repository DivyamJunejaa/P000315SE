import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, withCors } from '../../lib/cors';

describe('admin-backend lib/cors', () => {
  function makeRes() {
    const headers: Record<string, string> = {};
    let statusCode: number | null = null;
    let ended = false;
    return {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status: (code: number) => { statusCode = code; return { json: (b: any) => b, end: () => { ended = true; } }; },
      end: () => { ended = true; },
      headers,
      get statusCode() { return statusCode; },
      get ended() { return ended; }
    } as any;
  }

  it('handles OPTIONS preflight and sets headers', () => {
    const req = { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    const handled = applyCors(req, res);
    expect(handled).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(res.ended).toBe(true);
  });

  it('withCors blocks disallowed origin when credentials true', async () => {
    const req = { method: 'GET', headers: { origin: 'http://evil.com' } } as unknown as VercelRequest;
    const res = makeRes() as any;
    const wrapped = withCors(async (r, s) => { s.status(200).json({ ok: true }); });
    await wrapped(req, res);
    expect(res.statusCode).toBe(403);
  });
});