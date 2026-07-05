import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Subscription } from '../../types/billing.types';

const mockNavigate = vi.fn();
const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

const listInvoices = vi.fn();
const cancelSubscription = vi.fn();
const getInvoicePdf = vi.fn();
const verifySubscription = vi.fn();
vi.mock('../../services/billing.service', () => ({
  BillingService: {
    listInvoices: (...a: unknown[]) => listInvoices(...a),
    cancelSubscription: (...a: unknown[]) => cancelSubscription(...a),
    getInvoicePdf: (...a: unknown[]) => getInvoicePdf(...a),
    verifySubscription: (...a: unknown[]) => verifySubscription(...a),
  },
}));

import { BillingTab } from './BillingTab';

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

const invoice = {
  id: 'i1', cycle: 4, amount: 990000, currency: 'INR', status: 'completed',
  razorpay_payment_id: 'pay_1', paid_at: '2026-07-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z',
};

let rzpOpts: any;
const rzpOpen = vi.fn();

beforeEach(() => {
  mockNavigate.mockClear();
  showError.mockClear();
  showSuccess.mockClear();
  listInvoices.mockReset().mockResolvedValue({ items: [invoice], total: 1 });
  cancelSubscription.mockReset().mockResolvedValue(undefined);
  getInvoicePdf.mockReset().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  verifySubscription.mockReset().mockResolvedValue(undefined);
  rzpOpts = undefined;
  rzpOpen.mockReset();
  (window as any).Razorpay = vi.fn(function (this: any, o: any) { rzpOpts = o; this.open = rzpOpen; });
  URL.createObjectURL = vi.fn(() => 'blob:pdf');
  URL.revokeObjectURL = vi.fn();
});

describe('BillingTab', () => {
  test('renders the plan card + invoice rows after fetch', async () => {
    render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(await screen.findByText('#4')).toBeInTheDocument();
  });

  test('cancel flow opens the confirm dialog and calls the service', async () => {
    const onRefresh = vi.fn();
    render(<BillingTab subscription={sub} loading={false} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByText('Cancel subscription?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /yes, cancel/i }));
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledWith('rzp_1'));
    expect(onRefresh).toHaveBeenCalled();
  });

  test('cancel confirm dialog can be dismissed', async () => {
    render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await screen.findByText('Cancel subscription?');
    await userEvent.click(screen.getByRole('button', { name: /keep subscription/i }));
    await waitFor(() => expect(screen.queryByText('Cancel subscription?')).not.toBeInTheDocument());
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  test('cancel failure shows an error snackbar', async () => {
    cancelSubscription.mockRejectedValueOnce({ message: 'cancel boom' });
    render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await userEvent.click(await screen.findByRole('button', { name: /yes, cancel/i }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('cancel boom'));
  });

  test('loading with no subscription shows a spinner', () => {
    render(<BillingTab subscription={null} loading={true} onRefresh={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('no subscription routes to the plans page', async () => {
    render(<BillingTab subscription={null} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText(/No active subscription/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /view plans/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/plans');
  });

  test('missing plan data renders a fallback', () => {
    render(<BillingTab subscription={{ ...sub, plan: null as any }} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText('Plan data unavailable.')).toBeInTheDocument();
  });

  test('halted status warns about the payment failure', () => {
    render(<BillingTab subscription={{ ...sub, status: 'halted' }} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Payment failed/i)).toBeInTheDocument();
  });

  test('trial status shows the upgrade prompt and hides cancel', () => {
    render(<BillingTab subscription={{ ...sub, status: 'trial' }} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText(/upgrade to unlock/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade plan/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });

  test('cancelled status renders "Access until" and no cancel action', () => {
    render(<BillingTab subscription={{ ...sub, status: 'cancelled', is_auto_pay: false }} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByText('Access until')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });

  test('non-INR yearly plan formats price with the currency code', () => {
    render(
      <BillingTab
        subscription={{ ...sub, status: 'completed', plan: { ...sub.plan, currency: 'USD', interval: 'yearly', amount: 12000 } }}
        loading={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText('USD 120/year')).toBeInTheDocument();
  });

  test('created status completes payment via Razorpay', async () => {
    const onRefresh = vi.fn();
    render(<BillingTab subscription={{ ...sub, status: 'created' }} loading={false} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole('button', { name: /complete payment/i }));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 's', razorpay_signature: 'sig' });
    await waitFor(() => expect(verifySubscription).toHaveBeenCalled());
    expect(showSuccess).toHaveBeenCalledWith("You're on Starter!");
    expect(onRefresh).toHaveBeenCalled();
    // ondismiss resets the busy flag without error
    rzpOpts.modal.ondismiss();
  });

  test('created status: payment verification failure surfaces an error', async () => {
    verifySubscription.mockRejectedValueOnce({ message: 'verify boom' });
    render(<BillingTab subscription={{ ...sub, status: 'created' }} loading={false} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /complete payment/i }));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 's', razorpay_signature: 'sig' });
    await waitFor(() => expect(showError).toHaveBeenCalledWith('verify boom'));
  });

  test('created status: script load failure surfaces an error', async () => {
    delete (window as any).Razorpay;
    const orig = document.body.appendChild.bind(document.body);
    const spy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: any) => {
      if (node.tagName === 'SCRIPT') { setTimeout(() => node.onerror?.(), 0); return node; }
      return orig(node);
    });
    render(<BillingTab subscription={{ ...sub, status: 'created' }} loading={false} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /complete payment/i }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Could not load Razorpay checkout. Please try again.'));
    spy.mockRestore();
  });

  test('downloading an invoice fetches the PDF blob', async () => {
    const { container } = render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    await screen.findByText('#4');
    const btn = container.querySelector('button.row-action') as HTMLElement;
    await userEvent.click(btn);
    await waitFor(() => expect(getInvoicePdf).toHaveBeenCalledWith('i1'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  test('invoice download failure shows an error snackbar', async () => {
    getInvoicePdf.mockRejectedValueOnce(new Error('no pdf'));
    const { container } = render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    await screen.findByText('#4');
    await userEvent.click(container.querySelector('button.row-action') as HTMLElement);
    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith('Could not download the invoice. Please try again.'),
    );
  });

  test('renders invoice branches for non-INR / pending / missing fields', async () => {
    listInvoices.mockResolvedValue({
      items: [
        { id: 'i2', cycle: 5, amount: 5000, currency: 'USD', status: 'pending', razorpay_payment_id: null, paid_at: null, created_at: '2026-07-01T00:00:00Z' },
      ],
      total: 1,
    });
    render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    expect(await screen.findByText('USD 50')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  test('empty invoice list renders the empty state', async () => {
    listInvoices.mockResolvedValue({ items: [], total: 0 });
    render(<BillingTab subscription={sub} loading={false} onRefresh={vi.fn()} />);
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
  });
});
