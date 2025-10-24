import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRoutes from '../app/routes.jsx';

// Mock RichTextEditor used by TermsManagement
vi.mock('../components/RichTextEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea id="terms-content" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}));

// Stub terms API to avoid network
vi.mock('../features/admin/api/termsApi.js', async () => {
  const actual = await vi.importActual('../features/admin/api/termsApi.js');
  return {
    ...actual,
    fetchTerms: vi.fn().mockResolvedValue({
      content: 'Initial terms content ' + 'x'.repeat(60),
      updatedAt: '2024-01-01T00:00:00Z',
      version: 1,
    }),
    updateTerms: vi.fn(),
  };
});

const qc = new QueryClient();

describe('AppRoutes', () => {
  test('renders TermsManagement at /admin/terms with token handoff', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/terms?token=abc123"]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Terms editor label appears after ProtectedRoute completes auth check
    const label = await screen.findByLabelText(/Terms and Conditions Content/i, {}, { timeout: 2000 });
    expect(label).toBeInTheDocument();

    // Token stored by ProtectedRoute
    expect(localStorage.getItem('qfo_token')).toBe('abc123');
  });
});