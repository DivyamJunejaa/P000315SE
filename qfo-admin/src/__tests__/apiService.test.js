import api from '../../src/services/api';
import AxiosMockAdapter from 'axios-mock-adapter';

describe('api service', () => {
  let mock;
  const originalLocation = window.location;

  beforeEach(() => {
    mock = new AxiosMockAdapter(api);
    // Stub window.location.assign
    delete window.location;
    window.location = { assign: vi.fn() };
    localStorage.clear();
  });

  afterEach(() => {
    mock.restore();
    window.location = originalLocation;
    localStorage.clear();
  });

  test('adds Authorization header when token present', async () => {
    localStorage.setItem('qfo_token', 'abc');
    mock.onGet('/foo').reply((config) => {
      expect(config.headers.Authorization).toBe('Bearer abc');
      return [200, { ok: true }];
    });

    const res = await api.get('/foo');
    expect(res.status).toBe(200);
  });

  test('401 response clears token and redirects to my-app logout', async () => {
    localStorage.setItem('qfo_token', 'abc');
    import.meta.env.VITE_MYAPP_LOGIN_URL = 'http://localhost:3000/login';

    mock.onGet('/api/secure').reply(401, { message: 'Unauthorized' });

    await expect(api.get('/api/secure')).rejects.toBe('Unauthorized');

    // Token cleared and redirected
    expect(localStorage.getItem('qfo_token')).toBeNull();
    expect(window.location.assign).toHaveBeenCalledWith('http://localhost:3000/logout');
  });
});