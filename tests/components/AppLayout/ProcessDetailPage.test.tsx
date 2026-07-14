import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

const mockNavigate = vi.fn();
let routeParams: Record<string, string> = { processId: 'p1' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const getById = vi.fn();
const cancel = vi.fn();
const update = vi.fn();
const addRound = vi.fn();
vi.mock('../../../src/services/process.service', () => ({
  ProcessService: {
    getById: (...a: unknown[]) => getById(...a),
    cancel: (...a: unknown[]) => cancel(...a),
    update: (...a: unknown[]) => update(...a),
    addRound: (...a: unknown[]) => addRound(...a),
  },
}));

const ivGetById = vi.fn();
const ivUpdate = vi.fn();
const ivRemove = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: {
    getById: (...a: unknown[]) => ivGetById(...a),
    update: (...a: unknown[]) => ivUpdate(...a),
    remove: (...a: unknown[]) => ivRemove(...a),
  },
}));

const listMembers = vi.fn();
vi.mock('../../../src/services/invites.service', () => ({
  InvitesService: { listMembers: (...a: unknown[]) => listMembers(...a) },
}));

let authUser: any;
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

import ProcessDetailPage from '../../../src/components/AppLayout/ProcessDetailPage';

function singleRound(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    role: 'SDE-1',
    description: 'Backend track',
    candidate: { id: 'c9', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_name: 'Sam Lee',
    status: 'IN_PROGRESS' as const,
    rounds: [
      {
        id: 'r1',
        round_name: 'Technical',
        round_order: 1,
        status: 'SCHEDULED',
        scheduled_start_at: '2026-08-01T10:00:00.000Z',
        scheduled_end_at: '2026-08-01T11:00:00.000Z',
        interviewer: { first_name: 'Sam', last_name: 'Lee' },
        analysis: null,
      },
    ],
    ...over,
  };
}

function multiRound(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    role: 'SDE-1',
    description: 'Backend track',
    candidate: { id: 'c9', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
    created_at: '2026-01-01T00:00:00.000Z',
    created_by_name: 'Sam Lee',
    status: 'IN_PROGRESS' as const,
    rounds: [
      {
        id: 'r1',
        round_name: 'Technical',
        round_order: 1,
        status: 'ACTIVE',
        scheduled_start_at: '2026-08-01T10:00:00.000Z',
        scheduled_end_at: '2026-08-01T11:00:00.000Z',
        interviewer: { first_name: 'Sam', last_name: 'Lee' },
        analysis: { overall_score: 88, risk_level: 'LOW' },
      },
      {
        id: 'r2',
        round_name: 'HR',
        round_order: 2,
        status: 'COMPLETED',
        scheduled_start_at: '2026-08-02T10:00:00.000Z',
        scheduled_end_at: '2026-08-02T11:00:00.000Z',
        interviewer: null,
        analysis: null,
      },
    ],
    ...over,
  };
}

// A round session payload for InterviewService.getById used in edit mode.
// Uses a dynamic future start so the "future time" validation always passes.
function roundSession(over: Record<string, unknown> = {}) {
  const start = dayjs().add(2, 'day').startOf('hour');
  return {
    success: true,
    data: {
      id: 'r1',
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: start.add(1, 'hour').toISOString(),
      interview_session_participants: [{ interviewer_id: 'u1' }],
      provider_metadata: { join_url: 'https://meet.google.com/abc-defg-hij' },
      ...over,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeParams = { processId: 'p1' };
  authUser = { id: 'u1', company_id: 'c1', role: 'Owner' };
  listMembers.mockResolvedValue({
    success: true,
    data: {
      items: [
        { id: 'u1', first_name: 'Sam', last_name: 'Lee', email: 'sam@x.com' },
        { id: 'u2', first_name: 'Uma', last_name: 'Two', email: 'uma@x.com' },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    },
  });
  getById.mockResolvedValue({ success: true, data: singleRound() });
  ivGetById.mockResolvedValue(roundSession());
  ivUpdate.mockResolvedValue({ success: true });
  ivRemove.mockResolvedValue({ success: true });
  cancel.mockResolvedValue({ success: true });
  update.mockResolvedValue({ success: true });
  addRound.mockResolvedValue({ success: true });
});

describe('ProcessDetailPage — rendering & states', () => {
  test('renders the process details and round row', async () => {
    render(<ProcessDetailPage />);
    expect(await screen.findByRole('heading', { name: 'SDE-1' })).toBeInTheDocument();
    expect(screen.getByText('jane@x.com')).toBeInTheDocument();
    expect(screen.getByText('1 · Technical')).toBeInTheDocument();
    expect(screen.getByText('Backend track')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  test('shows a not-found state when the process is missing', async () => {
    getById.mockResolvedValue({ success: true, data: null });
    render(<ProcessDetailPage />);
    expect(await screen.findByText('Interview not found.')).toBeInTheDocument();
  });

  test('shows an error when loading the interview rejects', async () => {
    getById.mockRejectedValue(new Error('boom'));
    render(<ProcessDetailPage />);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('boom'));
    expect(await screen.findByText('Interview not found.')).toBeInTheDocument();
  });

  test('does nothing when processId is missing (refresh guard)', async () => {
    routeParams = {} as Record<string, string>;
    render(<ProcessDetailPage />);
    // refresh returns early — getById never called; loading stays true → spinner.
    await waitFor(() => expect(getById).not.toHaveBeenCalled());
  });

  test('swallows errors while loading team members', async () => {
    listMembers.mockRejectedValue(new Error('members-down'));
    render(<ProcessDetailPage />);
    // Page still renders fine even though the members fetch failed.
    expect(await screen.findByRole('heading', { name: 'SDE-1' })).toBeInTheDocument();
    expect(showError).not.toHaveBeenCalled();
  });

  test('ignores an unsuccessful members response', async () => {
    listMembers.mockResolvedValue({ success: false });
    render(<ProcessDetailPage />);
    expect(await screen.findByRole('heading', { name: 'SDE-1' })).toBeInTheDocument();
  });

  test('skips loading members when the user has no company', async () => {
    authUser = { id: 'u1' };
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    expect(listMembers).not.toHaveBeenCalled();
  });

  test('renders completed status and falls back to email + initials for a nameless candidate', async () => {
    getById.mockResolvedValue({
      success: true,
      data: singleRound({
        status: 'COMPLETED',
        description: undefined,
        candidate: { id: 'c9', first_name: '', last_name: '', email: 'zed@x.com' },
      }),
    });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // candidateName falls back to the email; initials fall back to first email char.
    const emails = screen.getAllByText('zed@x.com');
    expect(emails.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Z')).toBeInTheDocument();
    // description was undefined → no Description detail row.
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  test('renders multiple rounds with analysis, unassigned interviewer and disabled terminal actions', async () => {
    getById.mockResolvedValue({ success: true, data: multiRound() });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    expect(screen.getByText('2 · HR')).toBeInTheDocument();
    expect(screen.getByText('88 · LOW')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // The COMPLETED round (r2) has its action buttons disabled.
    const editIcons = screen.getAllByTestId('EditOutlinedIcon');
    expect(editIcons[1].closest('button')).toBeDisabled();
  });

  test('navigates to the round when its name is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await user.click(await screen.findByText('1 · Technical'));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/p1/rounds/r1');
  }, 20000);
});

describe('ProcessDetailPage — delete / cancel round', () => {
  test('cancelling the only round cancels the whole interview', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    expect(await screen.findByText('Cancel interview?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel interview' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('p1'));
    expect(showSuccess).toHaveBeenCalledWith('Interview cancelled');
    expect(mockNavigate).toHaveBeenCalledWith('/interviews');
  }, 20000);

  test('shows an error when cancelling the interview fails', async () => {
    cancel.mockResolvedValue({ success: false, message: 'nope' });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    await screen.findByText('Cancel interview?');
    await user.click(screen.getByRole('button', { name: 'Cancel interview' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('nope'));
  }, 20000);

  test('shows an error when cancelling throws', async () => {
    cancel.mockRejectedValue(new Error('crash'));
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    await screen.findByText('Cancel interview?');
    await user.click(screen.getByRole('button', { name: 'Cancel interview' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('crash'));
  }, 20000);

  test('keeping the interview closes the confirm dialog', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    await screen.findByText('Cancel interview?');
    await user.click(screen.getByRole('button', { name: 'Keep interview' }));
    await waitFor(() => expect(screen.queryByText('Cancel interview?')).not.toBeInTheDocument());
    expect(cancel).not.toHaveBeenCalled();
  }, 20000);

  test('removes a single round when it is not the only one', async () => {
    getById.mockResolvedValue({ success: true, data: multiRound() });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    // r1 is ACTIVE (not terminal) → its delete button is enabled.
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    expect(await screen.findByText('Cancel this round?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel round' }));
    await waitFor(() => expect(ivRemove).toHaveBeenCalledWith('r1'));
    expect(showSuccess).toHaveBeenCalledWith('Round cancelled');
  }, 20000);

  test('shows an error when removing a round fails', async () => {
    getById.mockResolvedValue({ success: true, data: multiRound() });
    ivRemove.mockResolvedValue({ success: false, message: 'busy' });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('DeleteOutlineIcon')[0].closest('button')!);
    await screen.findByText('Cancel this round?');
    await user.click(screen.getByRole('button', { name: 'Cancel round' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('busy'));
  }, 20000);
});

describe('ProcessDetailPage — add round dialog', () => {
  test('opens the Add round dialog', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    expect(await screen.findByRole('heading', { name: 'Add round' })).toBeInTheDocument();
  }, 20000);

  test('closes the Add round dialog on Cancel', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add round' })).not.toBeInTheDocument());
  }, 20000);

  test('validates a missing round name', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    expect(await screen.findByText('Round name is required')).toBeInTheDocument();
    expect(addRound).not.toHaveBeenCalled();
  }, 20000);

  test('validates a missing interviewer', async () => {
    authUser = { company_id: 'c1' }; // no id → no default interviewer
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    expect(await screen.findByText('Pick an interviewer')).toBeInTheDocument();
  }, 20000);

  test('validates a missing meeting link', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    expect(await screen.findByText('Meeting link is required')).toBeInTheDocument();
  }, 20000);

  test('validates a malformed meeting link', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.type(within(dialog).getByLabelText(/Meeting\ Link/), 'notaurl');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    expect(await screen.findByText('Meeting link must be a valid URL')).toBeInTheDocument();
  }, 20000);

  test('adds a round successfully', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.type(within(dialog).getByLabelText(/Meeting\ Link/), 'https://meet.google.com/abc-defg-hij');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    await waitFor(() => expect(addRound).toHaveBeenCalled());
    expect(showSuccess).toHaveBeenCalledWith('Round added');
    const payload = addRound.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.round_name).toBe('Managerial');
    expect(payload.interviewer_user_id).toBe('u1');
  }, 20000);

  test('surfaces a server error while adding a round', async () => {
    addRound.mockResolvedValue({ success: false, message: 'bad round' });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.type(within(dialog).getByLabelText(/Meeting\ Link/), 'https://meet.google.com/abc-defg-hij');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('bad round'));
  }, 20000);

  test('surfaces a thrown error while adding a round', async () => {
    addRound.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: /add round/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Round\ name/), 'Managerial');
    await user.type(within(dialog).getByLabelText(/Meeting\ Link/), 'https://meet.google.com/abc-defg-hij');
    await user.click(within(dialog).getByRole('button', { name: 'Add round' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('offline'));
  }, 20000);
});

describe('ProcessDetailPage — edit round dialog', () => {
  test('prefills from the session and updates the round', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('EditOutlinedIcon')[0].closest('button')!);
    expect(await screen.findByRole('heading', { name: 'Edit round' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    // Wait for the async session fetch to finish (Save enabled once ready).
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).not.toBeDisabled());
    const nameField = within(dialog).getByLabelText(/Round\ name/) as HTMLInputElement;
    expect(nameField.value).toBe('Technical');
    await user.clear(nameField);
    await user.type(nameField, 'Deep Dive');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ivUpdate).toHaveBeenCalled());
    expect(showSuccess).toHaveBeenCalledWith('Round updated');
    const payload = ivUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.round_name).toBe('Deep Dive');
    // Meeting link unchanged → not in payload.
    expect(payload.meeting_link).toBeUndefined();
  }, 20000);

  test('includes meeting link and interviewer changes in the update payload', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('EditOutlinedIcon')[0].closest('button')!);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).not.toBeDisabled());
    // Change the meeting link.
    const link = within(dialog).getByLabelText(/Meeting\ Link/);
    await user.clear(link);
    await user.type(link, 'https://zoom.us/j/999');
    // Change the interviewer select (u1 → u2).
    const combos = within(dialog).getAllByRole('combobox');
    await user.click(combos[0]);
    await user.click(await screen.findByRole('option', { name: 'Uma Two' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ivUpdate).toHaveBeenCalled());
    const payload = ivUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.meeting_link).toBe('https://zoom.us/j/999');
    expect(Array.isArray(payload.interview_session_participants)).toBe(true);
  }, 20000);

  test('shows an error when the round session response has no data', async () => {
    ivGetById.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('EditOutlinedIcon')[0].closest('button')!);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Failed to load round'));
  }, 20000);

  test('shows an error when the round session fetch rejects', async () => {
    ivGetById.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('EditOutlinedIcon')[0].closest('button')!);
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Failed to load round'));
  }, 20000);

  test('surfaces a server error while updating the round', async () => {
    ivUpdate.mockResolvedValue({ success: false, message: 'stale' });
    const user = userEvent.setup({ delay: null });
    render(<ProcessDetailPage />);
    await screen.findByText('1 · Technical');
    await user.click(screen.getAllByTestId('EditOutlinedIcon')[0].closest('button')!);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).not.toBeDisabled());
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('stale'));
  }, 20000);
});

describe('ProcessDetailPage — edit interview dialog', () => {
  async function openEditProcess(user: ReturnType<typeof userEvent.setup>) {
    render(<ProcessDetailPage />);
    await screen.findByRole('heading', { name: 'SDE-1' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    return screen.findByRole('dialog');
  }

  test('opens and updates the interview', async () => {
    const user = userEvent.setup({ delay: null });
    const dialog = await openEditProcess(user);
    expect(within(dialog).getByRole('heading', { name: 'Edit interview' })).toBeInTheDocument();
    const role = within(dialog).getByLabelText(/Role/);
    await user.clear(role);
    await user.type(role, 'SDE-2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(showSuccess).toHaveBeenCalledWith('Interview updated');
    const payload = update.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.role).toBe('SDE-2');
  }, 20000);

  test('validates an empty role', async () => {
    const user = userEvent.setup({ delay: null });
    const dialog = await openEditProcess(user);
    await user.clear(within(dialog).getByLabelText(/Role/));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Role is required'));
    expect(update).not.toHaveBeenCalled();
  }, 20000);

  test('surfaces a server error while updating the interview', async () => {
    update.mockResolvedValue({ success: false, message: 'conflict' });
    const user = userEvent.setup({ delay: null });
    const dialog = await openEditProcess(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('conflict'));
  }, 20000);

  test('surfaces a thrown error while updating the interview', async () => {
    update.mockRejectedValue(new Error('down'));
    const user = userEvent.setup({ delay: null });
    const dialog = await openEditProcess(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('down'));
  }, 20000);

  test('closes the edit interview dialog on Cancel', async () => {
    const user = userEvent.setup({ delay: null });
    const dialog = await openEditProcess(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit interview' })).not.toBeInTheDocument());
  }, 20000);
});
