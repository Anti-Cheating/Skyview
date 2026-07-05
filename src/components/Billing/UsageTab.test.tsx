import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageTab } from './UsageTab';
import type { Subscription } from '../../types/billing.types';

const sub: Subscription = {
  id: 'sub1',
  status: 'active',
  interviews_used: 3,
  interviews_remaining: 7,
  total_minutes_used: 120,
  current_cycle: 1,
  current_period_end: '2026-08-01T00:00:00Z',
  started_at: '2026-07-01T00:00:00Z',
  is_auto_pay: true,
  razorpay_subscription_id: 'rzp_1',
  short_url: null,
  seats_used: 2,
  key_id: 'key_1',
  plan: {
    id: 'p1', plan_key: 'starter_monthly', name: 'Starter', amount: 990000,
    currency: 'INR', interval: 'monthly', interviews_per_cycle: 10,
    minutes_per_interview: 60, max_seats: 5, is_active: true,
  },
};

describe('UsageTab', () => {
  test('renders usage stats from the subscription', () => {
    render(<UsageTab subscription={sub} loading={false} />);
    expect(screen.getByText('Interviews used')).toBeInTheDocument();
    expect(screen.getByText('7 remaining this cycle')).toBeInTheDocument();
    expect(screen.getByText('Seats used')).toBeInTheDocument();
    expect(screen.getByText('5 seats total')).toBeInTheDocument();
  });

  test('shows a spinner while loading with no data yet', () => {
    render(<UsageTab subscription={null} loading />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('prompts to choose a plan when there is no subscription', () => {
    render(<UsageTab subscription={null} loading={false} />);
    expect(screen.getByText('Choose a plan to view usage statistics.')).toBeInTheDocument();
  });
});
