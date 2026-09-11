import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const showSuccess = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../src/services/admin.service', () => ({
  AdminService: { plans: vi.fn(), updatePlan: vi.fn(), createPlan: vi.fn() },
}));

import { AdminService } from '../../../src/services/admin.service';
import PlansPage from '../../../src/components/Admin/PlansPage';

const plan = {
  id: 'plan-1', plan_key: 'starter_monthly', name: 'Starter', tier: 'starter', interval: 'monthly',
  amount: 499900, currency: 'INR', interviews_per_cycle: 100, minutes_per_interview: 45, max_seats: 20,
  is_active: true, sdk_access: false, features: ['Priority support'], companies_subscribed: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.plans).mockResolvedValue({ data: { items: [plan] } } as any);
  vi.mocked(AdminService.updatePlan).mockResolvedValue({ data: {} } as any);
  vi.mocked(AdminService.createPlan).mockResolvedValue({ data: {} } as any);
});

describe('PlansPage', () => {
  test('renders the heading and a plan row', async () => {
    render(<PlansPage />);
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('starter_monthly')).toBeInTheDocument();
  });

  // ── Edit any plan: FULL editor ───────────────────────────────────────

  test('Edit exposes the full field set incl. features; plan_key/tier are read-only', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Edit plan/)).toBeInTheDocument();

    // read-only identity
    expect(within(dialog).getByLabelText('Plan key')).toBeDisabled();
    // full fields present + pre-filled
    expect((within(dialog).getByLabelText('Name') as HTMLInputElement).value).toBe('Starter');
    expect((within(dialog).getByLabelText('Interviews / cycle') as HTMLInputElement).value).toBe('100');
    expect((within(dialog).getByLabelText('Minutes / interview') as HTMLInputElement).value).toBe('45');
    expect((within(dialog).getByLabelText('Max seats') as HTMLInputElement).value).toBe('20');
    // amount pre-filled in rupees (paise → ₹)
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).toBe('4999');
    // existing feature pre-filled
    expect((within(dialog).getByDisplayValue('Priority support'))).toBeInTheDocument();
  });

  test('Edit: change fields + add a feature persists everything (rupees→paise)', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');

    const interviews = within(dialog).getByLabelText('Interviews / cycle');
    await userEvent.clear(interviews);
    await userEvent.type(interviews, '150');
    const amount = within(dialog).getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '6000');

    await userEvent.click(within(dialog).getByRole('button', { name: /add feature/i }));
    const featInputs = within(dialog).getAllByPlaceholderText(/priority support/i);
    await userEvent.type(featInputs[featInputs.length - 1], 'SSO');

    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    expect(AdminService.updatePlan).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      interviews_per_cycle: 150,
      amount: 600000,                      // ₹6000 → paise
      minutes_per_interview: 45,
      max_seats: 20,
      is_active: true,
      features: ['Priority support', 'SSO'],
    }));
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Plan updated.'));
  });

  test('Edit: toggling SDK access is sent in the payload', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    // second switch is SDK access (first is Active)
    const sdkSwitch = within(dialog).getByRole('switch', { name: /SDK access|No SDK access/i });
    await userEvent.click(sdkSwitch);
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(AdminService.updatePlan).toHaveBeenCalledWith('plan-1', expect.objectContaining({ sdk_access: true }));
  });

  test('Edit: removing a feature drops it from the payload', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /remove feature 1/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(AdminService.updatePlan).toHaveBeenCalledWith('plan-1', expect.objectContaining({ features: [] }));
  });

  test('Cancel closes the edit dialog without saving', async () => {
    render(<PlansPage />);
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(AdminService.updatePlan).not.toHaveBeenCalled();
  });

  // ── Create: CUSTOM plans only ────────────────────────────────────────

  test('Create is custom-only: posts tier=custom with entered entitlements + features', async () => {
    render(<PlansPage />);
    await screen.findByText('Starter');
    await userEvent.click(screen.getByRole('button', { name: /create custom plan/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create custom plan')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Plan key'), 'custom_partner');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Partner Deal');
    await userEvent.type(within(dialog).getByLabelText('Interviews / cycle'), '50');
    await userEvent.type(within(dialog).getByLabelText('Max seats'), '20');
    await userEvent.click(within(dialog).getByRole('button', { name: /add feature/i }));
    await userEvent.type(within(dialog).getByPlaceholderText(/priority support/i), 'Dedicated support');
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));

    await vi.waitFor(() =>
      expect(AdminService.createPlan).toHaveBeenCalledWith(expect.objectContaining({
        plan_key: 'custom_partner', name: 'Partner Deal', tier: 'custom',
        interviews_per_cycle: 50, max_seats: 20, features: ['Dedicated support'],
      })),
    );
    await vi.waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Custom plan created.'));
  });

  test('Create: SDK access can be enabled on a custom plan', async () => {
    render(<PlansPage />);
    await screen.findByText('Starter');
    await userEvent.click(screen.getByRole('button', { name: /create custom plan/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Plan key'), 'sdk_partner');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'SDK Partner');
    await userEvent.type(within(dialog).getByLabelText('Interviews / cycle'), '1000');
    await userEvent.click(within(dialog).getByRole('switch', { name: /SDK access|No SDK access/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));

    await vi.waitFor(() =>
      expect(AdminService.createPlan).toHaveBeenCalledWith(expect.objectContaining({
        plan_key: 'sdk_partner', tier: 'custom', sdk_access: true,
      })),
    );
  });

  test('Create: blank amount/seats clear to null (unlimited / free); default hidden', async () => {
    render(<PlansPage />);
    await screen.findByText('Starter');
    await userEvent.click(screen.getByRole('button', { name: /create custom plan/i }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Plan key'), 'custom_unl');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Unlimited Seats');
    await userEvent.type(within(dialog).getByLabelText('Interviews / cycle'), '500');
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));

    await vi.waitFor(() => expect(AdminService.createPlan).toHaveBeenCalled());
    const body = vi.mocked(AdminService.createPlan).mock.calls[0][0] as Record<string, unknown>;
    expect(body.tier).toBe('custom');
    expect(body.max_seats).toBeNull();  // unlimited
    expect(body.amount).toBeNull();     // free / negotiated
    expect(body.is_active).toBe(false); // custom plans default hidden
  });

  test('Create: validation blocks an empty key', async () => {
    render(<PlansPage />);
    await screen.findByText('Starter');
    await userEvent.click(screen.getByRole('button', { name: /create custom plan/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'No Key');
    await userEvent.type(within(dialog).getByLabelText('Interviews / cycle'), '5');
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));
    expect(within(dialog).getByText('Plan key is required.')).toBeInTheDocument();
    expect(AdminService.createPlan).not.toHaveBeenCalled();
  });
});
