import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../src/routes/ProtectedRoutes.jsx';

describe('ProtectedRoute missing env', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Ensure token is missing and env not set
    localStorage.removeItem('qfo_token');
    delete import.meta.env.VITE_MYAPP_LOGIN_URL;
    // Stub window.location.assign to verify no redirect
    delete window.location;
    window.location = { assign: vi.fn() };
  });

  afterEach(() => {
    window.location = originalLocation;
    localStorage.clear();
  });

  test('shows configuration error when login URL is not set', () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ProtectedRoute><div>Secure</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for ProtectedRoute to finish checking and render error
    expect(screen.getByText('Configuration error: Login URL not set')).toBeInTheDocument();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});