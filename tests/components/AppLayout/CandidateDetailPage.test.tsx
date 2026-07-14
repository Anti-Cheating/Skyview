import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ candidateId: 'c9' }),
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const get = vi.fn();
const erase = vi.fn();
vi.mock('../../../src/services/candidates.service', () => ({
  CandidatesService: { get: (...a: unknown[]) => get(...a), erase: (...a: unknown[]) => erase(...a) },
}));

let authUser: any;
vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }));
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({ useSnackbar: () => ({ showSuccess, showError }) }));

import CandidateDetailPage from '../../../src/components/AppLayout/CandidateDetailPage';

const detail = {
  candidate: { id: 'c9', first_name: 'Priya', last_name: 'Sharma', email: 'priya@x.com' },
  interviews: [
    {
      process_id: 'p1', role: 'Senior Backend', created_at: '2026-01-01T00:00:00Z',
      rounds: [
        { id: 'r1', round_name: 'Screening', round_order: 1, status: 'COMPLETED', scheduled_start_at: '2026-08-01T10:00:00Z', interviewer: { first_name: 'Sam', last_name: 'Lee' }, analysis: { overall_score: 82, risk_level: 'LOW' } },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'u1', role: 'Owner' };
  get.mockResolvedValue({ success: true, data: detail });
  erase.mockResolvedValue({ success: true, data: { receipt: { id: 'x', requested_at: 'now' } } });
});

describe('CandidateDetailPage', () => {
  test('renders the candidate and their interviews table', async () => {
    render(<CandidateDetailPage />);
    expect((await screen.findAllByText('Priya Sharma')).length).toBeGreaterThan(0);
    expect(screen.getByText('Senior Backend')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument(); // rounds done/total
  });

  test('clicking an interview row opens its process detail', async () => {
    render(<CandidateDetailPage />);
    await userEvent.click(await screen.findByText('Senior Backend'));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/p1');
  });

  test('Owner can erase; confirms then calls the service and navigates', async () => {
    render(<CandidateDetailPage />);
    await screen.findAllByText('Priya Sharma');
    await userEvent.click(screen.getByRole('button', { name: /erase candidate data/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Erase data' }));
    await waitFor(() => expect(erase).toHaveBeenCalledWith('c9'));
    expect(showSuccess).toHaveBeenCalledWith('Candidate data erased');
  });

  test('Members do not see the erase action', async () => {
    authUser = { id: 'u2', role: 'Member' };
    render(<CandidateDetailPage />);
    await screen.findAllByText('Priya Sharma');
    expect(screen.queryByRole('button', { name: /erase candidate data/i })).not.toBeInTheDocument();
  });

  test('shows a not-found state when the candidate is missing', async () => {
    get.mockResolvedValue({ success: true, data: null });
    render(<CandidateDetailPage />);
    expect(await screen.findByText('Candidate not found.')).toBeInTheDocument();
  });
});
