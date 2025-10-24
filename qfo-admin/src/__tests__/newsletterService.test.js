import api from '../../src/services/api';
import { newsletterSubscribe, newsletterSend } from '../../src/services/newsletter.js';

describe('newsletter service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('newsletterSubscribe posts to subscribe endpoint', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { ok: true } });
    const res = await newsletterSubscribe('test@example.com');
    expect(postSpy).toHaveBeenCalledWith('/api/newsletter/subscribe', { email: 'test@example.com' });
    expect(res).toEqual({ ok: true });
  });

  test('newsletterSend posts to send endpoint', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { ok: true } });
    const res = await newsletterSend({ subject: 'Hello', html: '<h1>Hi</h1>' });
    expect(postSpy).toHaveBeenCalledWith('/api/newsletter/send', { subject: 'Hello', html: '<h1>Hi</h1>' });
    expect(res).toEqual({ ok: true });
  });
});