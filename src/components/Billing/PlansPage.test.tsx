import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Plan } from '../../types/billing.types';

const mockNavigate = vi.fn();
const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

const listPlans = vi.fn();
const getSubscription = vi.fn();
const createSubscription = vi.fn();
const verifySubscription = vi.fn();
vi.mock('../../services/billing.service', () => ({
  BillingService: {
    listPlans: (...a: unknown[]) => listPlans(...a),
    getSubscription: (...a: unknown[]) => getSubscription(...a),
    createSubscription: (...a: unknown[]) => createSubscription(...a),
    verifySubscription: (...a: unknown[]) => verifySubscription(...a),
  },
}));

import PlansPage from './PlansPage';

const trial: Plan = {
  id: 'pt', plan_key: 'trial', name: 'Free Trial', amount: 0, currency: 'INR',
  interval: null, interviews_per_cycle: 2, minutes_per_interview: 30, max_seats: 1, is_active: true,
};
const starter: Plan = {
  id: 'ps', plan_key: 'starter_monthly', name: 'Starter', amount: 990000, currency: 'INR',
  interval: 'monthly', interviews_per_cycle: 10, minutes_per_interview: 60, max_seats: 5, is_active: true,
};
const growthYearly: Plan = {
  id: 'gy', plan_key: 'growth_yearly', name: 'Growth', amount: 9900000, currency: 'INR',
  interval: 'yearly', interviews_per_cycle: 50, minutes_per_interview: 90, max_seats: null, is_active: true,
  features: ['Priority support', 'SSO'],
};

let rzpOpts: any;
const rzpOpen = vi.fn();

beforeEach(() => {
  mockNavigate.mockClear();
  showError.mockClear();
  showSuccess.mockClear();
  listPlans.mockReset().mockResolvedValue([trial, starter]);
  getSubscription.mockReset().mockResolvedValue(null);
  createSubscription.mockReset().mockResolvedValue({ subscription_id: 's', key_id: 'k', short_url: null });
  verifySubscription.mockReset().mockResolvedValue(undefined);
  rzpOpts = undefined;
  rzpOpen.mockReset();
  (window as any).Razorpay = vi.fn(function (this: any, o: any) { rzpOpts = o; this.open = rzpOpen; });
});

describe('PlansPage', () => {
  test('shows a spinner while loading', () => {
    render(<PlansPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders the plans after fetch', async () => {
    render(<PlansPage />);
    expect(await screen.findByText('Free Trial')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  test('starting the free trial creates a subscription and navigates', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /start free/i }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalledWith('trial'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
    expect(showSuccess).toHaveBeenCalledWith('Trial activated — no card required.');
  });

  test('listPlans failure surfaces an error', async () => {
    listPlans.mockRejectedValueOnce({ message: 'plans down' });
    render(<PlansPage />);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('plans down'));
  });

  test('selecting a paid plan opens Razorpay and verifies on success', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /^Select$/ }));
    await waitFor(() => expect(createSubscription).toHaveBeenCalledWith('starter_monthly'));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 's', razorpay_signature: 'sig' });
    await waitFor(() => expect(verifySubscription).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
    rzpOpts.modal.ondismiss();
  });

  test('paid plan: verification failure surfaces an error', async () => {
    verifySubscription.mockRejectedValueOnce({ message: 'verify boom' });
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /^Select$/ }));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 's', razorpay_signature: 'sig' });
    await waitFor(() => expect(showError).toHaveBeenCalledWith('verify boom'));
  });

  test('paid plan: checkout creation failure surfaces an error', async () => {
    createSubscription.mockRejectedValueOnce({ message: 'checkout boom' });
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /^Select$/ }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('checkout boom'));
  });

  test('script load failure blocks paid checkout', async () => {
    delete (window as any).Razorpay;
    const orig = document.body.appendChild.bind(document.body);
    const spy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: any) => {
      if (node.tagName === 'SCRIPT') { setTimeout(() => node.onerror?.(), 0); return node; }
      return orig(node);
    });
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /^Select$/ }));
    expect(showError).toHaveBeenCalledWith('Payment system unavailable. Refresh and try again.');
    expect(createSubscription).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('current plan is marked and not re-selectable', async () => {
    getSubscription.mockResolvedValue({ status: 'active', plan: { plan_key: 'starter_monthly' } } as any);
    render(<PlansPage />);
    const current = await screen.findByRole('button', { name: /current plan/i });
    expect(current).toBeDisabled();
    // Disabled ⇒ not re-selectable; clicking a pointer-events:none button is
    // rejected by userEvent, and the assertion above already proves intent.
    expect(createSubscription).not.toHaveBeenCalled();
  });

  test('pending subscription offers to complete payment', async () => {
    getSubscription.mockResolvedValue({
      status: 'created',
      plan: { plan_key: 'starter_monthly' },
      razorpay_subscription_id: 'r', key_id: 'k',
    } as any);
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /complete payment/i }));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 'r', razorpay_signature: 'sig' });
    await waitFor(() => expect(verifySubscription).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
  });

  test('pending subscription: verify failure surfaces an error', async () => {
    verifySubscription.mockRejectedValueOnce({ message: 'pending boom' });
    getSubscription.mockResolvedValue({
      status: 'created',
      plan: { plan_key: 'starter_monthly' },
      razorpay_subscription_id: 'r', key_id: 'k',
    } as any);
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /complete payment/i }));
    await waitFor(() => expect(rzpOpen).toHaveBeenCalled());
    await rzpOpts.handler({ razorpay_payment_id: 'p', razorpay_subscription_id: 'r', razorpay_signature: 'sig' });
    await waitFor(() => expect(showError).toHaveBeenCalledWith('pending boom'));
  });

  test('switching to the yearly tab shows yearly plans with features', async () => {
    listPlans.mockResolvedValue([trial, starter, growthYearly]);
    render(<PlansPage />);
    await screen.findByText('Starter');
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(await screen.findByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('✓ Priority support')).toBeInTheDocument();
    expect(screen.getByText('✓ Unlimited seats')).toBeInTheDocument();
  });
});
