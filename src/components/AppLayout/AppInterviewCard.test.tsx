import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let authUser: Record<string, unknown> | null = { id: 'viewer-1', role: 'Owner' };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

import AppInterviewCard from './AppInterviewCard';
import type { InterviewSession } from '../../types/interview.types';

function makeInterview(over: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: 'sess-1',
    title: 'Frontend Round 1',
    description: 'A great interview',
    status: 'ACTIVE',
    created_by: 'viewer-1',
    scheduled_start_at: '2026-08-01T10:00:00.000Z',
    scheduled_end_at: '2026-08-01T11:00:00.000Z',
    provider: 'google',
    duration_minutes: 60,
    company: { id: 'c1', name: 'Demo Corp', logo_url: null },
    interview_session_participants: [
      {
        id: 'p-cand',
        candidate_id: 'cand-9',
        candidate: { id: 'cand-9', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
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

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'viewer-1', role: 'Owner' };
});

describe('AppInterviewCard', () => {
  test('staff active session shows "Open Monitoring" and navigates to monitor', async () => {
    render(<AppInterviewCard interview={makeInterview()} userRole="Owner" />);
    expect(screen.getByText('Frontend Round 1')).toBeInTheDocument();
    // Candidate name shown for staff view.
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /open monitoring/i });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/sess-1/monitor');
  });

  test('candidate active session shows "Join Interview" and navigates to join', async () => {
    authUser = { id: 'cand-9', role: 'Candidate' };
    render(<AppInterviewCard interview={makeInterview()} userRole="Candidate" />);
    // Candidate view surfaces the company name.
    expect(screen.getByText('Demo Corp')).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /join interview/i });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/sess-1/join');
  });

  test('completed session renders a disabled "View Details" action', () => {
    render(<AppInterviewCard interview={makeInterview({ status: 'COMPLETED' })} userRole="Owner" />);
    const btn = screen.getByRole('button', { name: /view details/i });
    expect(btn).toBeDisabled();
  });

  test('fires onEdit when the edit icon is clicked (staff, non-terminal)', async () => {
    const onEdit = vi.fn();
    render(<AppInterviewCard interview={makeInterview()} userRole="Owner" onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /edit interview/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
