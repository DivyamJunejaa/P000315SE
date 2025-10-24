import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Newsletter from '../features/admin/Newsletter.jsx';

// Mock the newsletter service used by the component
vi.mock('../services/newsletter.js', () => ({
  newsletterSend: vi.fn(),
}));

import { newsletterSend } from '../services/newsletter.js';

describe('Newsletter component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('shows validation error when subject and html are empty', async () => {
    render(<Newsletter />);

    const sendButton = screen.getByRole('button', { name: /Send Campaign/i });
    fireEvent.click(sendButton);

    expect(await screen.findByText(/Subject and HTML are required/i)).toBeInTheDocument();
  });

  test('shows login required error when no token present', async () => {
    render(<Newsletter />);

    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText(/HTML Content/i), { target: { value: '<p>Hi</p>' } });

    const sendButton = screen.getByRole('button', { name: /Send Campaign/i });
    fireEvent.click(sendButton);

    expect(await screen.findByText(/Login required/i)).toBeInTheDocument();
  });

  test('sends campaign and shows results', async () => {
    localStorage.setItem('qfo_token', 'token');

    newsletterSend.mockResolvedValue({ data: { total: 3, sent: 2, failed: 1, failures: ['bad@example.com'] } });

    render(<Newsletter />);

    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: 'Spring Sale' } });
    fireEvent.change(screen.getByLabelText(/HTML Content/i), { target: { value: '<h1>Deals</h1>' } });

    fireEvent.click(screen.getByRole('button', { name: /Send Campaign/i }));

    expect(await screen.findByText(/Dispatch Results/i)).toBeInTheDocument();
    expect(screen.getByText(/Total:\s*3/i)).toBeInTheDocument();
    expect(screen.getByText(/Sent:\s*2/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed:\s*1/i)).toBeInTheDocument();
    expect(screen.getByText(/bad@example.com/i)).toBeInTheDocument();
  });

  test('shows error message when send fails', async () => {
    localStorage.setItem('qfo_token', 'token');

    newsletterSend.mockRejectedValue(new Error('boom'));

    render(<Newsletter />);

    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: 'Spring Sale' } });
    fireEvent.change(screen.getByLabelText(/HTML Content/i), { target: { value: '<h1>Deals</h1>' } });

    fireEvent.click(screen.getByRole('button', { name: /Send Campaign/i }));

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });
});