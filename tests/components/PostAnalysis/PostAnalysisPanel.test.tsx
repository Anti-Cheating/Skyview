import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ roundId: 's1', processId: 'p1' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

const getPostAnalysis = vi.fn();
const getById = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: {
    getPostAnalysis: (...a: unknown[]) => getPostAnalysis(...a),
    getById: (...a: unknown[]) => getById(...a),
  },
}));

import { PostAnalysisPanel } from '../../../src/components/PostAnalysis/PostAnalysisPanel';

const rawAnalysis = {
  id: 'an1', session_id: 's1', overall_score: 42, risk_score: 42, risk_level: 'Low',
  confidence: 'HIGH', keystroke_summary: 'Typing looked natural.',
  voice_summary: 'Voice steady.', app_summary: 'No risky apps.', image_summary: 'Clear.',
  full_transcript: 'Interviewer: Hello there\nCandidate: Hi, nice to meet you',
  keystroke_score: 30, voice_score: 40, image_score: 20, app_score: 10,
  final_summary: 'Overall a clean interview.',
  detected_app_categories: [],
  created_at: '2026-07-01T10:00:00Z', status: 'completed',
  consent_windows: [{ given_at: '2026-07-01T10:00:00Z', revoked_at: null, text_version: '1.0' }],
};

const session = {
  id: 's1', title: 'Frontend Engineer', scheduled_start_at: '2026-07-01T10:00:00Z',
  company: { name: 'Acme Corp' },
  interview_session_participants: [
    { id: 'p1', candidate_id: 'cand', candidate: { first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' } },
    { id: 'p2', interviewer_id: 'int', interviewer: { first_name: 'John', last_name: 'Smith' } },
  ],
};

beforeEach(() => {
  getPostAnalysis.mockResolvedValue({ success: true, data: rawAnalysis });
  getById.mockResolvedValue({ success: true, data: session });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('PostAnalysisPanel', () => {
  test('renders the candidate name + risk score after the analysis resolves', async () => {
    render(<PostAnalysisPanel />);
    expect(await screen.findByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  test('shows the consent / monitoring-coverage line', async () => {
    render(<PostAnalysisPanel />);
    await screen.findByRole('heading', { name: 'Jane Doe' });
    expect(screen.getByText('Monitoring coverage')).toBeInTheDocument();
  });

  test('copy-transcript writes the transcript to the clipboard', async () => {
    render(<PostAnalysisPanel />);
    await screen.findByRole('heading', { name: 'Jane Doe' });
    await userEvent.click(screen.getByRole('button', { name: /copy transcript/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rawAnalysis.full_transcript);
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  test('a failed backend synthesis (overall_score: null) shows an "analysis incomplete" state, not a fake Score: 0 (regression)', async () => {
    getPostAnalysis.mockResolvedValue({
      success: true,
      data: { ...rawAnalysis, overall_score: null, risk_level: 'ANALYSIS_FAILED' },
    });
    render(<PostAnalysisPanel />);
    expect(await screen.findByText(/Analysis could not be completed/i)).toBeInTheDocument();
    // Must never silently coerce the null into a real-looking "0" verdict.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('ANALYSIS_FAILED')).not.toBeInTheDocument();
  });
});
