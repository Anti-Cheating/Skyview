import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { UseRiskSocketReturn } from '../../../src/hooks/useRiskSocket';

// ── Mocks ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ roundId: 'round-1' }),
  useNavigate: () => mockNavigate,
}));

const showInfo = vi.fn();
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showInfo, showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showSnackbar: vi.fn() }),
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'interviewer-1', role: 'Owner' } }),
}));

// useRiskSocket is swapped per test via this mutable object.
let riskState: UseRiskSocketReturn;
vi.mock('../../../src/hooks/useRiskSocket', () => ({ useRiskSocket: () => riskState }));

let helperState: Record<string, unknown>;
vi.mock('../../../src/hooks/useHelper', () => ({ useHelper: () => helperState }));

const activate = vi.fn();
const heartbeat = vi.fn();
const deactivate = vi.fn();
const getById = vi.fn();
vi.mock('../../../src/services/interview.service', () => ({
  InterviewService: {
    activate: (...a: unknown[]) => activate(...a),
    heartbeat: (...a: unknown[]) => heartbeat(...a),
    deactivate: (...a: unknown[]) => deactivate(...a),
    getById: (...a: unknown[]) => getById(...a),
  },
}));

// Stub AnalyticsPanel — it pulls in recharts and is covered by its own test.
vi.mock('../../../src/components/Monitoring/AnalyticsPanel', () => ({
  default: () => <div data-testid="analytics-panel" />,
}));

import MonitoringView from '../../../src/components/Monitoring/MonitoringView';

function makeRiskData(over: Partial<UseRiskSocketReturn> = {}): UseRiskSocketReturn {
  return {
    results: [], latestResult: null, averageScore: 0, recentScore: 0,
    highestRisk: 'none', isConnected: true, pulseAlerts: [], transcriptFragments: [],
    imageAnalysisResults: [], latestImageAnalysis: null, isImageAnalysisProcessing: false,
    pendingImageAnalysisCount: 0, incrementPendingImageAnalysis: vi.fn(),
    emitCaptureScreenshots: vi.fn(), emitStartTranscription: vi.fn(), emitStopTranscription: vi.fn(),
    emitStartAnalysis: vi.fn(), emitStopAnalysis: vi.fn(), modalityState: null, panelActivity: null,
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

  test('leaving the page does not end the session', async () => {
    const { unmount } = render(<MonitoringView />);
    await screen.findByRole('heading', { name: 'Frontend Engineer' });
    unmount();
    expect(deactivate).not.toHaveBeenCalled();
  });
});

describe('MonitoringView — who did it', () => {
  test("another viewer's action shows a toast with their name", async () => {
    riskState = makeRiskData({
      panelActivity: { action: 'analysis_off', actor: { id: 'u2', name: 'Priya Shah' }, at: 1 },
    });
    render(<MonitoringView />);
    await waitFor(() => expect(showInfo).toHaveBeenCalledWith('Priya Shah turned analysis off'));
    expect(mockNavigate).not.toHaveBeenCalledWith('/interviews');
  });

  test('when someone else ends the interview, everyone is told and leaves', async () => {
    riskState = makeRiskData({
      panelActivity: { action: 'ended', actor: { id: 'u2', name: 'Priya Shah' }, at: 1 },
    });
    render(<MonitoringView />);
    await waitFor(() => expect(showInfo).toHaveBeenCalledWith('Priya Shah ended the interview'));
    expect(mockNavigate).toHaveBeenCalledWith('/interviews');
  });
});

describe('MonitoringView — two viewers', () => {
  test("another viewer turning transcription off stays off (this tab doesn't switch it back on)", async () => {
    const emitStartTranscription = vi.fn();
    sessionStorage.setItem('skyview:txn:round-1', '1'); // this tab turned it on earlier
    riskState = makeRiskData({ emitStartTranscription, modalityState: { transcription: true, analysis: false } });
    const { rerender } = render(<MonitoringView />);
    await waitFor(() => expect(activate).toHaveBeenCalled());

    // The other viewer switches it off → Cortex broadcasts the new state.
    riskState = makeRiskData({ emitStartTranscription, modalityState: { transcription: false, analysis: false } });
    rerender(<MonitoringView />);

    await waitFor(() => expect(sessionStorage.getItem('skyview:txn:round-1')).toBe('0'));
    expect(emitStartTranscription).not.toHaveBeenCalled();
  });

  test('a reconnect while another viewer stayed adopts their "off" instead of switching it back on', async () => {
    const emitStartTranscription = vi.fn();
    sessionStorage.setItem('skyview:txn:round-1', '1');
    // Rejoin catch-up into a room someone else kept alive: not fresh.
    riskState = makeRiskData({ emitStartTranscription, modalityState: { transcription: false, analysis: false, fresh: false } });
    render(<MonitoringView />);
    await waitFor(() => expect(sessionStorage.getItem('skyview:txn:round-1')).toBe('0'));
    expect(emitStartTranscription).not.toHaveBeenCalled();
  });

  test('the only viewer coming back restores what this tab had on', async () => {
    const emitStartTranscription = vi.fn();
    sessionStorage.setItem('skyview:txn:round-1', '1');
    // Cortex wiped the state when the last viewer left: fresh.
    riskState = makeRiskData({ emitStartTranscription, modalityState: { transcription: false, analysis: false, fresh: true } });
    render(<MonitoringView />);
    await waitFor(() => expect(emitStartTranscription).toHaveBeenCalledTimes(1));
  });
});
