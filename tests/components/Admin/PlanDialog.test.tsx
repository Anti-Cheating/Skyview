import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const plansMock = vi.fn();
const assignPlan = vi.fn();
vi.mock('../../../src/services/admin.service', () => ({
  AdminService: {
    plans: (...a: unknown[]) => plansMock(...a),
    assignPlan: (...a: unknown[]) => assignPlan(...a),
  },
}));

import PlanDialog from '../../../src/components/Admin/PlanDialog';

const catalog = {
  data: {
    items: [
      { id: 'p1', plan_key: 'trial', name: 'Trial', tier: 'trial', interviews_per_cycle: 3, max_seats: 3, minutes_per_interview: 60, is_active: true, companies_subscribed: 7 },
      { id: 'p2', plan_key: 'custom-partner', name: 'Partner 50', tier: 'custom', interviews_per_cycle: 50, max_seats: 20, minutes_per_interview: 100, is_active: false, companies_subscribed: 0 },
    ],
  },
};

const onClose = vi.fn();
const onDone = vi.fn();

beforeEach(() => {
  plansMock.mockReset().mockResolvedValue(catalog);
  assignPlan.mockReset().mockResolvedValue({ data: {} });
  onClose.mockClear();
  onDone.mockClear();
});

describe('PlanDialog — assign', () => {
  test('lists plans (incl. hidden custom ones) and assigns the selected one', async () => {
    render(<PlanDialog open companyId="c1" companyName="Acme" onClose={onClose} onDone={onDone} />);
    await waitFor(() => expect(plansMock).toHaveBeenCalled());

    await userEvent.click(await screen.findByRole('combobox'));
    // hidden custom plan is still assignable here
    await userEvent.click(await screen.findByRole('option', { name: /Partner 50.*hidden/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Assign$/ }));

    await waitFor(() => expect(assignPlan).toHaveBeenCalledWith('c1', { plan_id: 'p2' }));
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('warns when the chosen plan is shared by other companies', async () => {
    render(<PlanDialog open companyId="c1" onClose={onClose} onDone={onDone} />);
    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Trial/ }));
    expect(await screen.findByText(/7 companies are already/)).toBeInTheDocument();
  });

  test('refuses to submit without a selection', async () => {
    render(<PlanDialog open companyId="c1" onClose={onClose} onDone={onDone} />);
    await waitFor(() => expect(plansMock).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /^Assign$/ }));
    expect(await screen.findByText('Pick a plan first.')).toBeInTheDocument();
    expect(assignPlan).not.toHaveBeenCalled();
  });

  test('API failure surfaces in the dialog and keeps it open', async () => {
    assignPlan.mockRejectedValueOnce({ message: 'nope' });
    render(<PlanDialog open companyId="c1" onClose={onClose} onDone={onDone} />);
    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Partner 50/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Assign$/ }));
    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
