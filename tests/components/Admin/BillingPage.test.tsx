import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../src/services/admin.service', () => ({
  AdminService: { billingSummary: vi.fn(), payments: vi.fn() },
}));

import { AdminService } from '../../../src/services/admin.service';
import BillingPage from '../../../src/components/Admin/BillingPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.billingSummary).mockResolvedValue({
    data: { total: 20, by_plan: { pro: 12 }, by_status: { active: 18 }, self_hosted: 2, mrr_paise: 250000, lifetime_revenue_paise: 4000000 },
  } as any);
  vi.mocked(AdminService.payments).mockResolvedValue({
    data: {
      items: [
        { id: 'pay-1', amount: 99900, currency: 'INR', status: 'paid', paid_at: '2026-01-01', created_at: '2026-01-01', company_id: 'c1', company_name: 'Acme Inc' },
      ],
      total: 1,
    },
  } as any);
});

describe('BillingPage', () => {
  test('renders the heading and summary stat cards', async () => {
    render(<BillingPage />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(await screen.findByText('Total subscriptions')).toBeInTheDocument();
    expect(screen.getByText('MRR')).toBeInTheDocument();
  });

  test('renders a payment row after the fetch resolves', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  test('shows the by-plan breakdown', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('pro')).toBeInTheDocument();
  });
});
