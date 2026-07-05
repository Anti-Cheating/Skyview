import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const createProcess = vi.fn();
vi.mock('../../services/process.service', () => ({
  ProcessService: { create: (...a: unknown[]) => createProcess(...a) },
}));

const listMembers = vi.fn();
vi.mock('../../services/invites.service', () => ({
  InvitesService: { listMembers: (...a: unknown[]) => listMembers(...a) },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', company_id: 'c1', role: 'Owner' } }),
}));

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

import CreateProcessPage from './CreateProcessPage';

beforeEach(() => {
  vi.clearAllMocks();
  listMembers.mockResolvedValue({
    success: true,
    data: { items: [{ id: 'u1', first_name: 'Sam', last_name: 'Lee', email: 'sam@x.com' }], total: 1, page: 1, pageSize: 100 },
  });
  createProcess.mockResolvedValue({ success: true, data: { id: 'proc-1', round_id: 'r1' } });
});

describe('CreateProcessPage', () => {
  test('renders the form scaffold', async () => {
    render(<CreateProcessPage />);
    expect(screen.getByRole('heading', { name: 'New interview' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Candidate First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Role/i)).toBeInTheDocument();
    // Interviewer defaults to the current user once members load.
    await waitFor(() => expect(listMembers).toHaveBeenCalled());
  });

  test('validation blocks submit and surfaces an inline error', async () => {
    render(<CreateProcessPage />);
    await userEvent.click(screen.getByRole('button', { name: /create interview/i }));
    expect(await screen.findByText('Role is required')).toBeInTheDocument();
    expect(createProcess).not.toHaveBeenCalled();
  });

  test('a complete form submits and navigates to the new interview', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateProcessPage />);
    await waitFor(() => expect(listMembers).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/Candidate First Name/i), 'Jane');
    await user.type(screen.getByLabelText(/Candidate Last Name/i), 'Doe');
    await user.type(screen.getByLabelText(/Candidate Email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^Role/i), 'SDE-1');
    await user.type(screen.getByLabelText(/Meeting Link/i), 'https://meet.google.com/abc-defg-hij');

    await user.click(screen.getByRole('button', { name: /create interview/i }));

    await waitFor(() => expect(createProcess).toHaveBeenCalled());
    const payload = createProcess.mock.calls[0][0];
    expect(payload.role).toBe('SDE-1');
    expect(payload.candidate_email).toBe('jane@example.com');
    expect(payload.first_round.interviewer_user_id).toBe('u1');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/interviews/proc-1'));
  }, 20000);
});
