import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { UseRiskSocketReturn } from '../../hooks/useRiskSocket';

// ── Mocks ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ roundId: 'round-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'interviewer-1', role: 'Owner' } }),
}));

// useRiskSocket is swapped per test via this mutable object.
let riskState: UseRiskSocketReturn;
vi.mock('../../hooks/useRiskSocket', () => ({ useRiskSocket: () => riskState }));

let helperState: Record<string, unknown>;
vi.mock('../../hooks/useHelper', () => ({ useHelper: () => helperState }));

const activate = vi.fn();
const heartbeat = vi.fn();
const deactivate = vi.fn();
const getById = vi.fn();
vi.mock('../../services/interview.service', () => ({
  InterviewService: {
    activate: (...a: unknown[]) => activate(...a),
    heartbeat: (...a: unknown[]) => heartbeat(...a),
    deactivate: (...a: unknown[]) => deactivate(...a),
    getById: (...a: unknown[]) => getById(...a),
  },
}));

// Stub AnalyticsPanel — it pulls in recharts and is covered by its own test.
vi.mock('./AnalyticsPanel', () => ({
  default: () => <div data-testid="analytics-panel" />,
}));

import MonitoringView from './MonitoringView';

function makeRiskData(over: Partial<UseRiskSocketReturn> = {}): UseRiskSocketReturn {
  return {
    results: [], latestResult: null, averageScore: 0, recentScore: 0,
    highestRisk: 'none', isConnected: true, pulseAlerts: [], transcriptFragments: [],
    imageAnalysisResults: [], latestImageAnalysis: null, isImageAnalysisProcessing: false,
    pendingImageAnalysisCount: 0, incrementPendingImageAnalysis: vi.fn(),
    emitCaptureScreenshots: vi.fn(), emitStartTranscription: vi.fn(), emitStopTranscription: vi.fn(),
    emitStartAnalysis: vi.fn(), emitStopAnalysis: vi.fn(), modalityState: null,
    candidateStatus: null, consentStatus: null,
    setInitialConsentStatus: vi.fn(), setInitialCandidateStatus: vi.fn(),
    ...over,
  };
}

const interview = {
  id: 'round-1',
  title: 'Frontend Engineer',
  status: 'ACTIVE',
  interview_session_participants: [
    { id: 'p1', candidate_id: 'cand-1', candidate: { first_name: 'Alice', last_name: 'Ng' } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  riskState = makeRiskData();
  helperState = { installed: false, checking: false, status: null, join: vi.fn(), leave: vi.fn(), refresh: vi.fn(), health: null };
  activate.mockResolvedValue({ success: true });
  heartbeat.mockResolvedValue({ data: { status: 'ACTIVE' } });
  deactivate.mockResolvedValue({ success: true });
  getById.mockResolvedValue({ success: true, data: interview });
  localStorage.setItem('auth_access_token', 'test-token');
});

describe('MonitoringView', () => {
  test('renders the interview header once loaded', async () => {
    render(<MonitoringView />);
    expect(await screen.findByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument();
    expect(screen.getByTestId('analytics-panel')).toBeInTheDocument();
    expect(activate).toHaveBeenCalledWith('round-1');
  });

  test('shows an error alert when the interview fails to load', async () => {
    getById.mockResolvedValue({ success: false, message: 'Nope' });
    render(<MonitoringView />);
    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });

  test('activation failure surfaces an error + redirect message', async () => {
    activate.mockResolvedValue({ success: false, message: 'Session already ended' });
    render(<MonitoringView />);
    expect(await screen.findByText(/Session already ended/)).toBeInTheDocument();
  });

  test('revoked consent renders the withdrawal banner', async () => {
    riskState = makeRiskData({
      consentStatus: { status: 'revoked', at: '2026-07-05T10:00:00.000Z' },
    });
    render(<MonitoringView />);
    expect(await screen.findByText(/withdrew monitoring consent/i)).toBeInTheDocument();
  });

  test('declined consent renders the declined banner', async () => {
    riskState = makeRiskData({
      consentStatus: { status: 'declined', at: '2026-07-05T10:00:00.000Z' },
    });
    render(<MonitoringView />);
    expect(await screen.findByText(/declined monitoring consent/i)).toBeInTheDocument();
  });

  test('Connected chip reflects the socket state', async () => {
    render(<MonitoringView />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  test('End Interview opens the confirm dialog then deactivates + navigates', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MonitoringView />);
    await screen.findByRole('heading', { name: 'Frontend Engineer' });

    await user.click(screen.getByRole('button', { name: /end interview/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('End this interview?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /end interview/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/interviews'));
    expect(deactivate).toHaveBeenCalledWith('round-1');
  });
});
