import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const usage = vi.fn();
const invoices = vi.fn();
const updateBillingContact = vi.fn();
vi.mock('../../services/billing.service', () => ({
  BillingService: {
    usage: (...a: unknown[]) => usage(...a),
    invoices: (...a: unknown[]) => invoices(...a),
    updateBillingContact: (...a: unknown[]) => updateBillingContact(...a),
  },
}));

import BillingPage from './BillingPage';

beforeEach(() => {
  usage.mockResolvedValue({
    data: {
      current: 5, plan: 'growth', plan_limit: 100, cap_policy: 'soft',
      overage_per_session_usd: 2, estimated: 10, last_reset_at: '2026-07-01T00:00:00Z',
      billing_contact_email: 'ap@co.com', is_v2: true,
    },
  });
  invoices.mockResolvedValue({
    data: {
      invoices: [{
        id: 'inv1', period: '2026-06', total_usd: '50.00', status: 'paid',
        due_at: '2026-07-01T00:00:00Z', paid_at: '2026-07-02T00:00:00Z',
        pdf_url: null, paid_via: 'card', payment_reference: 'ref1',
      }],
    },
  });
  updateBillingContact.mockResolvedValue(undefined);
});

describe('Settings/BillingPage', () => {
  test('renders usage, plan stats, and invoice rows after fetch', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('5 of 100 sessions this month')).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
  });

  test('saving the billing contact calls the service', async () => {
    render(<BillingPage />);
    await screen.findByText('Billing');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateBillingContact).toHaveBeenCalledWith('ap@co.com'));
    expect(await screen.findByText('Billing contact updated.')).toBeInTheDocument();
  });
});
