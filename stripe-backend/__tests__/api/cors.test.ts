import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, handleCORS } from '../../api/utils/cors';

describe('stripe-backend api/cors', () => {
  function makeRes() {
    const headers: Record<string, string> = {};
    let statusCode: number | null = null;
    let ended = false;
    return {
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status: (code: number) => ({ 
        json: (b: any) => { statusCode = code; return b; },
        end: () => { statusCode = code; ended = true; }
      }),
      end: () => { ended = true; },
      headers,
      get statusCode() { return statusCode; },
      get ended() { return ended; }
    } as any;
  }

  it('sets CORS headers based on allowed origins', () => {
    process.env.ALLOWED_ORIGINS = 'http://a.com,http://b.com';
    const req = { headers: { origin: 'http://b.com' } } as unknown as VercelRequest;
    const res = makeRes();
    setCORSHeaders(res as any, req);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://b.com');
  });

  it('handles OPTIONS request and ends', () => {
    const req = { method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } } as unknown as VercelRequest;
    const res = makeRes();
    const handled = handleCORS(req, res as any);
    expect(handled).toBe(true);
    expect(res.ended).toBe(true);
  });
});