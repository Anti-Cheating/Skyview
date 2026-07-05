import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Subscription } from '../../types/billing.types';

let authUser: { role: string } | null;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const getSubscription = vi.fn();
const listInvoices = vi.fn();
vi.mock('../../services/billing.service', () => ({
  BillingService: {
    getSubscription: (...a: unknown[]) => getSubscription(...a),
    listInvoices: (...a: unknown[]) => listInvoices(...a),
  },
}));

import BillingPage from './BillingPage';

const sub: Subscription = {
  id: 'sub1', status: 'active', interviews_used: 3, interviews_remaining: 7,
  total_minutes_used: 120, current_cycle: 1, current_period_end: '2026-08-01T00:00:00Z',
  started_at: '2026-07-01T00:00:00Z', is_auto_pay: true, razorpay_subscription_id: 'rzp_1',
  short_url: null, seats_used: 2, key_id: 'key_1',
  plan: {
    id: 'p1', plan_key: 'starter_monthly', name: 'Starter', amount: 990000, currency: 'INR',
    interval: 'monthly', interviews_per_cycle: 10, minutes_per_interview: 60, max_seats: 5, is_active: true,
  },
};

beforeEach(() => {
  authUser = { role: 'Owner' };
  getSubscription.mockResolvedValue(sub);
  listInvoices.mockResolvedValue({ items: [], total: 0 });
});

describe('BillingPage', () => {
  test('managers see the billing page + usage tab with data', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('Billing & Usage')).toBeInTheDocument();
    expect(await screen.findByText('Interviews used')).toBeInTheDocument();
  });

  test('non-managers are blocked with an info notice', async () => {
    authUser = { role: 'Member' };
    render(<BillingPage />);
    // findBy lets the pending getSubscription() state settle inside act().
    expect(await screen.findByText(/Only Owners and Admins can manage billing/)).toBeInTheDocument();
  });
});
