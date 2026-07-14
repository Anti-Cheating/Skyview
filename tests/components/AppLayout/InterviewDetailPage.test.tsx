import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
let routeParams: Record<string, string> = { roundId: 'r1', processId: 'p1' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeParams,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const getSession = vi.fn();
const triggerPostAnalysis = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: {
    getById: (...a: unknown[]) => getSession(...a),
    triggerPostAnalysis: (...a: unknown[]) => triggerPostAnalysis(...a),
  },
}));

const getProcess = vi.fn();
vi.mock('../../../src/services/process.service', () => ({
  ProcessService: { getById: (...a: unknown[]) => getProcess(...a) },
}));

const showError = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError }),
}));

// The analysis + activity panels have their own data flows — stub them so this
// suite stays focused on the detail page's own header/tabs behaviour.
vi.mock('../../../src/components/PostAnalysis', () => ({ PostAnalysisPanel: () => <div>PANEL</div>, default: () => <div>PANEL</div> }));
vi.mock('../../../src/components/PostAnalysis/ActivityExplorer', () => ({ default: () => <div>ACTIVITY</div> }));

import InterviewDetailPage from '../../../src/components/AppLayout/InterviewDetailPage';

function session(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    title: 'Frontend Round',
    status: 'SCHEDULED',
    scheduled_start_at: '2026-08-01T10:00:00.000Z',
    scheduled_end_at: '2026-08-01T11:00:00.000Z',
    duration_minutes: 60,
    created_at: '2026-01-01T00:00:00.000Z',
    has_analysis: false,
    company: { id: 'c1', name: 'Demo Corp' },
    interview_session_participants: [
      { id: 'p1', candidate_id: 'c9', candidate: { id: 'c9', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' } },
      { id: 'p2', interviewer_id: 'u1', interviewer: { id: 'u1', first_name: 'Sam', last_name: 'Lee', email: 'sam@x.com' } },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeParams = { roundId: 'r1', processId: 'p1' };
  getSession.mockResolvedValue({ success: true, data: session() });
  getProcess.mockResolvedValue({
    success: true,
    data: { id: 'p1', role: 'SDE-1', rounds: [{ id: 'r1', round_name: 'Technical' }] },
  });
  triggerPostAnalysis.mockResolvedValue({ success: true, data: { status: 'started' } });
});

describe('InterviewDetailPage', () => {
  test('renders the session title, candidate card, and Start button', async () => {
    render(<InterviewDetailPage />);
    expect(await screen.findByText('Frontend Round')).toBeInTheDocument();
    // Candidate name is shown twice (avatar block + Name field row).
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    expect(screen.getByText('jane@x.com')).toBeInTheDocument();
    expect(screen.getByText('Interview Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start interview/i })).toBeInTheDocument();
  });

  test('Start Interview navigates to the monitor route', async () => {
    render(<InterviewDetailPage />);
    await screen.findByText('Frontend Round');
    await userEvent.click(screen.getByRole('button', { name: /start interview/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews/p1/rounds/r1/monitor');
  });

  test('Analysis tab explains analysis is unavailable until completion', async () => {
    render(<InterviewDetailPage />);
    await screen.findByText('Frontend Round');
    await userEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(
      await screen.findByText(/analysis becomes available once the interview is completed/i)
    ).toBeInTheDocument();
  });

  test('a completed session can trigger post-analysis', async () => {
    getSession.mockResolvedValue({ success: true, data: session({ status: 'COMPLETED' }) });
    render(<InterviewDetailPage />);
    await screen.findByText('Frontend Round');
    await userEvent.click(screen.getByRole('tab', { name: 'Analysis' }));

    const analyse = await screen.findByRole('button', { name: /analyse interview/i });
    await userEvent.click(analyse);
    await waitFor(() => expect(triggerPostAnalysis).toHaveBeenCalledWith('r1'));
  });
});
