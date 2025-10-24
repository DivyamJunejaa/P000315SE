import api from '../../src/services/api';
import { fetchDashboard, adaptDashboard } from '../../src/features/admin/api/dashboard.api';

describe('dashboard.api', () => {
  test('fetchDashboard calls /api/dashboard', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: { data: { overview: {} } },
    });

    const payload = await fetchDashboard();
    expect(getSpy).toHaveBeenCalledTimes(1);
    const calledUrl = getSpy.mock.calls[0][0];
    expect(calledUrl).toMatch(/^\/api\/dashboard(\?quick=1)?$/);
    expect(payload).toEqual({ data: { overview: {} } });

    getSpy.mockRestore();
  });

  test('adaptDashboard normalizes numbers and maps charts', () => {
    const payload = {
      data: {
        overview: {
          users: { total: '10', newThisMonth: '2' },
          subscriptions: { total: '20', active: '18', trialing: '1', pastDue: '1', canceled: '0', incomplete: null },
          revenue: {
            amountCents: 123456,
            count: '5',
            period: 'month',
            growth: { currentMonth: '2000', lastMonth: '1500', growthPercent: '33.3' },
          },
          premiumCustomers: { total: '5', new: '1', churn: '0' },
          proCustomers: { total: '10', new: '2', churn: '1' },
          traffic: { today: 10, monthly: null, quarterly: undefined },
        },
        charts: {
          revenueTrend: [{ month: 'Jan', revenue: '1000' }, { month: 'Feb', revenue: '1500' }],
          trafficTrend: [{ month: 'Jan', traffic: '100' }, { month: 'Feb', traffic: '200' }],
        },
        recentSubscriptions: [{ id: 'X', amountCents: '999', status: 'active' }],
      },
    };

    const res = adaptDashboard(payload);

    expect(res.overview.users.total).toBe(10);
    expect(res.overview.subscriptions.active).toBe(18);
    expect(res.overview.revenue.amountCents).toBe(123456);
    expect(res.overview.revenue.growth.growthPercent).toBe(33.3);
    expect(res.charts.revenueTrend[0]).toEqual({ month: 'Jan', revenue: 1000 });
    expect(res.charts.trafficTrend[1]).toEqual({ month: 'Feb', traffic: 200 });
    expect(res.recentSubscriptions.length).toBe(1);
  });
});