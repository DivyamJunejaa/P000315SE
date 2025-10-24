import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../features/admin/AdminDashboard.jsx';

vi.mock('../features/admin/hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

const { useDashboard } = await import('../features/admin/hooks/useDashboard');

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows loading state', () => {
    useDashboard.mockReturnValue({ isLoading: true, isError: false, data: null, refetch: vi.fn() });

    render(<Dashboard />);
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument();
  });

  test('shows error and retry calls refetch', () => {
    const refetch = vi.fn();
    useDashboard.mockReturnValue({ isLoading: false, isError: true, data: null, refetch });

    render(<Dashboard />);
    const retry = screen.getByText('Retry');
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalled();
  });

  test('renders overview and empty chart messages', () => {
    useDashboard.mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      data: {
        overview: {
          proCustomers: { total: 100, new: 10, churn: 5 },
          premiumCustomers: { total: 50, new: 5, churn: 2 },
          traffic: { today: 10, monthly: 100, quarterly: 300 },
          revenue: { amountCents: 123456, period: 'month', growth: { growthPercent: 12.3 } },
        },
        charts: { trafficTrend: [], revenueTrend: [] },
        recentSubscriptions: [],
      },
    });

    render(<Dashboard />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Pro Customers')).toBeInTheDocument();
    expect(screen.getByText('Premium Customers')).toBeInTheDocument();

    // AUD formatting
    expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument();

    // Empty charts
    expect(screen.getByText('No traffic data yet.')).toBeInTheDocument();
    expect(screen.getByText('No revenue data yet.')).toBeInTheDocument();
  });

  test('shows subscriptions and toggles More/Less, opens Stripe on Update', () => {
    const subs = Array.from({ length: 7 }).map((_, i) => ({
      id: `S${i+1}`,
      userName: `User ${i+1}`,
      tier: i % 2 ? 'premium' : 'pro',
      period: 'monthly',
      amountCents: 999 + i,
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'past_due' : 'canceled',
    }));

    useDashboard.mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      data: {
        overview: {
          proCustomers: { total: 100, new: 10, churn: 5 },
          premiumCustomers: { total: 50, new: 5, churn: 2 },
          traffic: { today: 10, monthly: 100, quarterly: 300 },
          revenue: { amountCents: 123456, period: 'month', growth: { growthPercent: 12.3 } },
        },
        charts: {
          trafficTrend: [{ month: 'Jan', traffic: 100 }, { month: 'Feb', traffic: 120 }],
          revenueTrend: [{ month: 'Jan', revenue: 1000 }, { month: 'Feb', revenue: 1500 }],
        },
        recentSubscriptions: subs,
      },
    });

    // Stub window.open for Stripe Update button
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    import.meta.env.VITE_STRIPE_DASHBOARD_PAYOUT_URL = 'https://example.com/payouts';

    render(<Dashboard />);

    // More/Less toggle present and works
    const moreBtn = screen.getByText('More');
    expect(moreBtn).toBeInTheDocument();
    // Initially 5 rows
    expect(document.querySelectorAll('tbody tr').length).toBe(5);
    fireEvent.click(moreBtn);
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr').length).toBe(7);

    // Click Update payout
    const updateBtn = screen.getByText('Update');
    fireEvent.click(updateBtn);
    expect(openSpy).toHaveBeenCalledWith('https://example.com/payouts', '_blank', 'noopener');

    openSpy.mockRestore();
  });
});