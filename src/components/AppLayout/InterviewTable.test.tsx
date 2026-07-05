import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'viewer-1', role: 'Owner' } }),
}));

import InterviewTable from './InterviewTable';
import type { InterviewSession } from '../../types/interview.types';

function makeRow(over: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: 'sess-7',
    title: 'Backend Round 2',
    status: 'SCHEDULED',
    created_by: 'viewer-1',
    scheduled_start_at: '2026-08-01T10:00:00.000Z',
    scheduled_end_at: '2026-08-01T11:00:00.000Z',
    provider: 'google',
    duration_minutes: 45,
    interview_session_participants: [
      {
        id: 'p-cand',
        candidate_id: 'cand-1',
        candidate: { id: 'cand-1', first_name: 'Ada', last_name: 'Byte', email: 'ada@x.com' },
      },
      {
        id: 'p-int',
        interviewer_id: 'viewer-1',
        interviewer: { id: 'viewer-1', first_name: 'Sam', last_name: 'Lee', email: 'sam@x.com' },
      },
    ],
    ...over,
  } as InterviewSession;
}

beforeEach(() => vi.clearAllMocks());

describe('InterviewTable', () => {
  test('renders headers and row data', () => {
    render(<InterviewTable rows={[makeRow()]} userRole="Owner" />);
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('Candidate')).toBeInTheDocument();
    expect(screen.getByText('Backend Round 2')).toBeInTheDocument();
    expect(screen.getByText('Ada Byte')).toBeInTheDocument();
    // The logged-in interviewer gets a YOU badge.
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  test('clicking the interview title navigates to the detail page', async () => {
    render(<InterviewTable rows={[makeRow()]} userRole="Owner" />);
    await userEvent.click(screen.getByRole('button', { name: 'Backend Round 2' }));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/sess-7');
  });

  test('with a process_id, clicking deep-links to the round detail', async () => {
    render(<InterviewTable rows={[makeRow({ process_id: 'proc-1' })]} userRole="Owner" />);
    await userEvent.click(screen.getByRole('button', { name: 'Backend Round 2' }));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/proc-1/rounds/sess-7');
  });

  test('renders the empty state when there are no rows', () => {
    render(<InterviewTable rows={[]} userRole="Owner" emptyText="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  test('fires onDelete for a manager on a non-terminal row', async () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    render(<InterviewTable rows={[makeRow()]} userRole="Owner" onEdit={onEdit} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel interview/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
