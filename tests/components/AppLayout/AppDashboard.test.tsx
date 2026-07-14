import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const getCounts = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: { getCounts: (...a: unknown[]) => getCounts(...a) },
}));

const checkHelperHealth = vi.fn();
vi.mock('../../../src/services/helperBridge', () => ({
  checkHelperHealth: (...a: unknown[]) => checkHelperHealth(...a),
}));

let authUser: Record<string, unknown> | null = { id: 'u1', role: 'Owner', first_name: 'Sam', last_name: 'Lee' };
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

import AppDashboard from '../../../src/components/AppLayout/AppDashboard';

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'u1', role: 'Owner', first_name: 'Sam', last_name: 'Lee' };
  getCounts.mockResolvedValue({ success: true, data: { all: 5, scheduled: 2, completed: 3 } });
});

describe('AppDashboard', () => {
  test('renders the heading and stat cards populated from getCounts', async () => {
    render(<AppDashboard />);
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Upcoming Interviews')).toBeInTheDocument();
    expect(screen.getByText('Past Interviews')).toBeInTheDocument();
    expect(screen.getByText('Total Interviews')).toBeInTheDocument();
    // Values from the mocked counts: upcoming=2, past=3, total=5.
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  test('clicking a stat card navigates to the interviews list', async () => {
    render(<AppDashboard />);
    await screen.findByText('2');
    await userEvent.click(screen.getByText('Upcoming Interviews'));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews');
  });

  test('candidate reauthorize probes the helper and reports success', async () => {
    authUser = { id: 'c1', role: 'Candidate', first_name: 'Cara', last_name: 'Dev' };
    checkHelperHealth.mockResolvedValue({ ok: true });
    render(<AppDashboard />);

    const reauth = await screen.findByRole('button', { name: /reauthorize/i });
    await userEvent.click(reauth);

    expect(checkHelperHealth).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith('Trueyy Helper is running.');
  });
});
