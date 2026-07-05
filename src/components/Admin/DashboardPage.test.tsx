import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: { dashboard: vi.fn() },
}));

import { AdminService } from '../../services/admin.service';
import DashboardPage from './DashboardPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.dashboard).mockResolvedValue({
    data: {
      companies: 12, cloud: 8, self_hosted: 4, users: 140,
      active_subscriptions: 9, mrr_paise: 500000, lifetime_revenue_paise: 9000000,
      interviews: 320, active_interviews: 3, failed_webhooks: 1, contact_queries: 5, licenses: 4,
      by_plan: { pro: 6, enterprise: 3 }, by_status: { active: 9 },
    },
  } as any);
});

describe('DashboardPage', () => {
  test('renders the heading and platform stat cards after fetch', async () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument(); // companies
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(screen.getByText('MRR')).toBeInTheDocument();
  });

  test('renders the by-plan breakdown from the fetched data', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('pro')).toBeInTheDocument();
    expect(screen.getByText('enterprise')).toBeInTheDocument();
  });
});
