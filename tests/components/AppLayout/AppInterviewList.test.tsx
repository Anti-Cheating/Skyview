import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const getSessions = vi.fn();
const remove = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: {
    getSessions: (...a: unknown[]) => getSessions(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}));

let authUser: Record<string, unknown> | null = { id: 'u1', role: 'Owner' };
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError, showSuccess }),
}));

import AppInterviewList from '../../../src/components/AppLayout/AppInterviewList';
import type { InterviewSession } from '../../../src/types/interview.types';

function makeItem(over: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: 'sess-1',
    title: 'Frontend Round 1',
    status: 'SCHEDULED',
    created_by: 'u1',
    scheduled_start_at: '2026-08-01T10:00:00.000Z',
    scheduled_end_at: '2026-08-01T11:00:00.000Z',
    provider: 'google',
    duration_minutes: 60,
    company: { id: 'c1', name: 'Demo Corp', logo_url: null },
    interview_session_participants: [
      { id: 'p1', candidate_id: 'cand-1', candidate: { id: 'cand-1', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' } },
    ],
    ...over,
  } as InterviewSession;
}

function listResponse(items: InterviewSession[]) {
  return {
    success: true,
    data: {
      items,
      total: items.length,
      counts: { all: items.length, scheduled: items.length, completed: 0 },
      page: 1,
      pageSize: 10,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'u1', role: 'Owner' };
  getSessions.mockResolvedValue(listResponse([makeItem()]));
});
afterEach(() => vi.useRealTimers());

describe('AppInterviewList', () => {
  test('staff view renders the heading, New Interview button, and table rows', async () => {
    render(<AppInterviewList />);
    expect(screen.getByRole('heading', { name: 'Interviews', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Frontend Round 1')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /new interview/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/new');
  });

  test('candidate view renders interviews as cards', async () => {
    authUser = { id: 'cand-1', role: 'Candidate' };
    render(<AppInterviewList />);
    expect(await screen.findByText('Frontend Round 1')).toBeInTheDocument();
    // Candidate cards surface the company name.
    expect(screen.getByText('Demo Corp')).toBeInTheDocument();
  });

  test('selecting a status pill refetches with that status', async () => {
    render(<AppInterviewList />);
    await screen.findByText('Frontend Round 1');
    getSessions.mockClear();

    const pills = screen.getByText('Completed').closest('.MuiChip-root')!;
    await userEvent.click(within(pills as HTMLElement).getByText('Completed'));

    await waitFor(() =>
      expect(getSessions).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    );
  });
});
