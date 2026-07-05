import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
let routeParams: Record<string, string> = {};
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
}));

const getById = vi.fn();
const createInterview = vi.fn();
const update = vi.fn();
vi.mock('../../services/interview.service', () => ({
  InterviewService: {
    getById: (...a: unknown[]) => getById(...a),
    createInterview: (...a: unknown[]) => createInterview(...a),
    update: (...a: unknown[]) => update(...a),
  },
}));

const listMembers = vi.fn();
vi.mock('../../services/invites.service', () => ({
  InvitesService: { listMembers: (...a: unknown[]) => listMembers(...a) },
}));

// The real MUI DateTimePicker + AdapterDayjs are extremely slow to mount
// under jsdom (~10s per render), which blows every timeout. Swap them for
// a lightweight text input that still drives the component's `value` /
// `onChange` contract so the Schedule field stays fully exercised.
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@mui/x-date-pickers/AdapterDayjs', () => ({ AdapterDayjs: class {} }));
vi.mock('@mui/x-date-pickers/DateTimePicker', async () => {
  const React = await import('react');
  const dayjs = (await import('dayjs')).default;
  return {
    DateTimePicker: ({ value, onChange, disabled }: {
      value: unknown;
      onChange: (v: unknown) => void;
      disabled?: boolean;
    }) =>
      React.createElement('input', {
        'aria-label': 'Schedule datetime',
        disabled,
        value: value && (value as { isValid?: () => boolean }).isValid?.()
          ? (value as { toISOString: () => string }).toISOString()
          : '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value ? dayjs(e.target.value) : null),
      }),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', company_id: 'c1', role: 'Owner' } }),
}));

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

import CreateInterviewPage from './CreateInterviewPage';

beforeEach(() => {
  vi.clearAllMocks();
  routeParams = {};
  listMembers.mockResolvedValue({
    success: true,
    data: { items: [{ id: 'u1', first_name: 'Sam', last_name: 'Lee', email: 'sam@x.com' }], total: 1, page: 1, pageSize: 100 },
  });
  createInterview.mockResolvedValue({ success: true, data: { id: 'sess-1', title: 'Frontend R1' } });
  update.mockResolvedValue({ success: true, data: { id: 'sess-1', title: 'Edited' } });
});

describe('CreateInterviewPage — create mode', () => {
  test('renders the create heading and fields', async () => {
    render(<CreateInterviewPage />);
    expect(screen.getByRole('heading', { name: 'New Interview', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Interview Title/i)).toBeInTheDocument();
    await waitFor(() => expect(listMembers).toHaveBeenCalled());
  }, 20000);

  test('a valid form submits via createInterview', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateInterviewPage />);
    await waitFor(() => expect(listMembers).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/Interview Title/i), 'Frontend R1');
    await user.type(screen.getByLabelText(/Candidate First Name/i), 'Jane');
    await user.type(screen.getByLabelText(/Candidate Last Name/i), 'Doe');
    await user.type(screen.getByLabelText(/Candidate Email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/Meeting Link/i), 'https://meet.google.com/abc-defg-hij');

    const submit = screen.getByRole('button', { name: /create interview/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(createInterview).toHaveBeenCalled());
    const payload = createInterview.mock.calls[0][0];
    expect(payload.title).toBe('Frontend R1');
    expect(payload.interview_session_participants).toEqual(
      expect.arrayContaining([expect.objectContaining({ interviewer_user_id: 'u1' })])
    );
  }, 20000);
});

describe('CreateInterviewPage — edit mode', () => {
  test('prefills the form from the loaded session', async () => {
    routeParams = { id: 'sess-1' };
    getById.mockResolvedValue({
      success: true,
      data: {
        id: 'sess-1',
        title: 'Existing Interview',
        description: 'notes',
        status: 'SCHEDULED',
        scheduled_start_at: '2026-08-01T10:00:00.000Z',
        scheduled_end_at: '2026-08-01T11:00:00.000Z',
        provider_metadata: { join_url: 'https://meet.google.com/x' },
        interview_session_participants: [
          { id: 'p1', candidate_id: 'c9', candidate: { id: 'c9', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' } },
          { id: 'p2', interviewer_id: 'u1' },
        ],
      },
    });

    render(<CreateInterviewPage />);
    expect(await screen.findByRole('heading', { name: 'Edit Interview', level: 1 })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Existing Interview')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@x.com')).toBeInTheDocument();
  }, 20000);
});
