import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showSuccess = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: { plans: vi.fn(), updatePlan: vi.fn() },
}));

import { AdminService } from '../../services/admin.service';
import PlansPage from './PlansPage';

const plan = {
  id: 'plan-1', plan_key: 'pro_monthly', name: 'Pro', tier: 'pro', interval: 'month',
  amount: 499900, currency: 'INR', interviews_per_cycle: 100, minutes_per_interview: 45, max_seats: 20, is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.plans).mockResolvedValue({ data: { items: [plan] } } as any);
  vi.mocked(AdminService.updatePlan).mockResolvedValue({ data: {} } as any);
});

describe('PlansPage', () => {
  test('renders the heading and a plan row', async () => {
    render(<PlansPage />);
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(await screen.findByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('pro_monthly')).toBeInTheDocument();
  });

  test('Edit opens the dialog and Save persists the change', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Edit plan/)).toBeInTheDocument();

    const input = within(dialog).getByLabelText('Interviews / cycle');
    await userEvent.clear(input);
    await userEvent.type(input, '150');
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    expect(AdminService.updatePlan).toHaveBeenCalledWith('plan-1', expect.objectContaining({ interviews_per_cycle: 150, is_active: true }));
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Plan updated.'));
  });

  test('Cancel closes the edit dialog without saving', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(AdminService.updatePlan).not.toHaveBeenCalled();
  });
});
