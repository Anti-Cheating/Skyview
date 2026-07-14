import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsPanel from '../../../src/components/Monitoring/AnalyticsPanel';
import type {
  UseRiskSocketReturn,
  WindowResult,
  ModalityRisk,
  ImageAnalysisResult,
  TranscriptFragment,
  PulseAlert,
} from '../../../src/hooks/useRiskSocket';

// ── jsdom shims ──
// recharts (ScoreTimelineChart) + ThumbnailCarousel both reach for
// ResizeObserver, which jsdom doesn't implement. Stub it, and stub recharts
// with trivial passthrough components so the chart renders deterministically
// under jsdom instead of measuring a 0×0 container.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverStub;

vi.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Passthrough = ({ children }: any) => <div data-testid="rechart">{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    Line: () => null,
    Tooltip: () => null,
    ReferenceArea: () => null,
    YAxis: () => null,
  };
});

function makeRiskData(over: Partial<UseRiskSocketReturn> = {}): UseRiskSocketReturn {
  return {
    results: [],
    latestResult: null,
    averageScore: 0,
    recentScore: 0,
    highestRisk: 'none',
    isConnected: true,
    pulseAlerts: [],
    transcriptFragments: [],
    imageAnalysisResults: [],
    latestImageAnalysis: null,
    isImageAnalysisProcessing: false,
    pendingImageAnalysisCount: 0,
    incrementPendingImageAnalysis: vi.fn(),
    emitCaptureScreenshots: vi.fn(),
    emitStartTranscription: vi.fn(),
    emitStopTranscription: vi.fn(),
    emitStartAnalysis: vi.fn(),
    emitStopAnalysis: vi.fn(),
    modalityState: null,
    candidateStatus: null,
    consentStatus: null,
    setInitialConsentStatus: vi.fn(),
    setInitialCandidateStatus: vi.fn(),
    ...over,
  };
}

// ── factories ──
let idCounter = 0;
function modality(over: Partial<ModalityRisk> = {}): ModalityRisk {
  return {
    risk_level: 'medium',
    risk_score: 50,
    signals: [],
    summary: '',
    evidence: [],
    ...over,
  };
}
function win(over: Partial<WindowResult> = {}): WindowResult {
  idCounter += 1;
  return {
    window_id: `w${idCounter}`,
    session_id: 's1',
    risk: 'low',
    score: 10,
    summary: '',
    status: 'done',
    processed_at: '2026-07-05T10:00:00Z',
    ...over,
  };
}
function imageResult(over: Partial<ImageAnalysisResult> = {}): ImageAnalysisResult {
  idCounter += 1;
  return {
    analysis_id: `ia${idCounter}`,
    session_id: 's1',
    status: 'done',
    risk: 'high',
    score: 72,
    summary: '',
    image_count: 2,
    processed_at: '2026-07-05T10:00:00Z',
    image_signals: [],
    image_evidence: [],
    thumbnail_urls: [],
    ...over,
  };
}
function fragment(over: Partial<TranscriptFragment> = {}): TranscriptFragment {
  return {
    text: 'hello',
    is_final: true,
    timestamp: '2026-07-05T10:00:00Z',
    speaker_role: 'candidate',
    ...over,
  };
}

function renderPanel(over: Partial<UseRiskSocketReturn> = {}, props: Record<string, unknown> = {}) {
  return render(
    <AnalyticsPanel
      riskData={makeRiskData(over)}
      onClose={vi.fn()}
      onToggleTranscription={vi.fn()}
      onToggleAnalysis={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalyticsPanel', () => {
  test('smoke: renders the header + all four tabs, empty Alerts state', () => {
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        onClose={vi.fn()}
        onToggleTranscription={vi.fn()}
        onToggleAnalysis={vi.fn()}
      />,
    );
    expect(screen.getByText('Risk Analytics')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Risk Timeline')).toBeInTheDocument();
    expect(screen.getByText('Image Analysis')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('No alerts yet')).toBeInTheDocument();
  });

  test('Transcription toggle calls onToggleTranscription with true', async () => {
    const onToggleTranscription = vi.fn();
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        onClose={vi.fn()}
        onToggleTranscription={onToggleTranscription}
        onToggleAnalysis={vi.fn()}
      />,
    );
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]);
    expect(onToggleTranscription).toHaveBeenCalledWith(true);
  });

  test('Analysis toggle calls onToggleAnalysis with true', async () => {
    const onToggleAnalysis = vi.fn();
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        onClose={vi.fn()}
        onToggleTranscription={vi.fn()}
        onToggleAnalysis={onToggleAnalysis}
      />,
    );
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[1]);
    expect(onToggleAnalysis).toHaveBeenCalledWith(true);
  });

  test('Capture is disabled while Analysis is off', () => {
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        analysisOn={false}
        onClose={vi.fn()}
        onToggleTranscription={vi.fn()}
        onToggleAnalysis={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /capture/i })).toBeDisabled();
  });

  test('switching to the Transcript tab shows the empty-transcript hint', async () => {
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        onClose={vi.fn()}
        onToggleTranscription={vi.fn()}
        onToggleAnalysis={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByRole('tab')[3]);
    expect(screen.getByText('No transcript yet')).toBeInTheDocument();
  });

  test('"Open meeting link" opens the join URL in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <AnalyticsPanel
        riskData={makeRiskData()}
        interview={{ provider_metadata: { join_url: 'https://meet.google.com/x' } }}
        onClose={vi.fn()}
        onToggleTranscription={vi.fn()}
        onToggleAnalysis={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /open meeting link/i }));
    expect(openSpy).toHaveBeenCalledWith('https://meet.google.com/x', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  // ── Header states ──

  test('header shows "Monitoring active" when isMonitoring', () => {
    renderPanel({}, { isMonitoring: true });
    expect(screen.getByText('Monitoring active')).toBeInTheDocument();
  });

  test('header shows "Connecting..." when the socket is not connected', () => {
    renderPanel({ isConnected: false });
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  test('toolbar (toggles/capture) is hidden when no toggle handlers are supplied', () => {
    render(<AnalyticsPanel riskData={makeRiskData()} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /capture/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  // ── Capture button states ──

  test('Capture is enabled with analysis on and fires both emitters when clicked', async () => {
    const incrementPendingImageAnalysis = vi.fn();
    const emitCaptureScreenshots = vi.fn();
    renderPanel(
      { incrementPendingImageAnalysis, emitCaptureScreenshots },
      { analysisOn: true },
    );
    const btn = screen.getByRole('button', { name: /capture/i });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(incrementPendingImageAnalysis).toHaveBeenCalledWith(1);
    expect(emitCaptureScreenshots).toHaveBeenCalledTimes(1);
  });

  test('Capture is disabled while a previous capture is still processing', () => {
    renderPanel({ isImageAnalysisProcessing: true }, { analysisOn: true });
    expect(screen.getByRole('button', { name: /capture/i })).toBeDisabled();
  });

  test('Capture is disabled when candidate screen recording is off', () => {
    renderPanel(
      {
        candidateStatus: {
          extension_installed: true,
          screen_recording: false,
          mic_granted: true,
          keyboard_granted: true,
          joined: true,
          updated_at: null,
        },
      },
      { analysisOn: true },
    );
    expect(screen.getByRole('button', { name: /capture/i })).toBeDisabled();
  });

  // ── Summary stats + score timeline chart ──

  test('summary stats render score/risk/window/signal counts and the timeline chart', () => {
    const results = [
      win({ risk: 'low', score: 30, per_modality: { app_metadata: modality({ signals: ['tab_switch'] }) } }),
      win({ risk: 'high', score: 90, per_modality: { keystroke: modality({ signals: ['paste', 'copy'] }) }, correlations: [{ finding: 'x', signals_involved: ['a'], impact: 'strong' }] }),
    ];
    renderPanel({
      results,
      latestResult: results[1],
      averageScore: 60,
      recentScore: 70,
      highestRisk: 'high',
    });
    // Recent / Session numbers
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    // Windows count (2) + signals total (1 + 2 = 3) — these digits also
    // appear in tab badges, so assert presence rather than uniqueness.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    // Latest progress bar
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // correlation summary line
    expect(screen.getByText(/1 correlation detected/i)).toBeInTheDocument();
    // chart rendered (mocked recharts)
    expect(screen.getAllByTestId('rechart').length).toBeGreaterThan(0);
  });

  test('latest confidence chip renders when present', () => {
    const results = [
      win({ score: 40 }),
      win({ score: 55, confidence: 'high' }),
    ];
    renderPanel({ results, latestResult: results[1], highestRisk: 'medium' });
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  // ── Analysis (Risk Timeline) tab ──

  test('Analysis tab empty + connected shows the "First analysis" hint', async () => {
    renderPanel({ isConnected: true });
    await userEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByText('First analysis in ~30 seconds')).toBeInTheDocument();
  });

  test('Analysis tab empty + disconnected shows a spinner and Connecting text', async () => {
    renderPanel({ isConnected: false });
    await userEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // Both the header and the panel body say Connecting...
    expect(screen.getAllByText('Connecting...').length).toBeGreaterThan(0);
  });

  test('Analysis tab renders a single WindowCard (auto-expanded latest) with full breakdown', async () => {
    const detailed = win({
      risk: 'critical',
      score: 95,
      confidence: 'medium',
      summary: 'Heavy AI-tool usage detected across the window.',
      per_modality: {
        app_metadata: modality({ risk_level: 'critical', risk_score: 90, signals: ['ai_tool_open'], evidence: ['ChatGPT window visible'], summary: 'AI tool foreground' }),
        keystroke: modality({ risk_level: 'high', risk_score: 80 }),
        voice: modality({ risk_level: 'no', risk_score: 5 }),
      },
      correlations: [
        { finding: 'Paste burst followed app switch', signals_involved: ['paste', 'app_switch'], impact: 'moderate' },
      ],
      timeline_note: 'Spike right after the coding question was asked.',
    });
    renderPanel({ results: [detailed], latestResult: detailed, highestRisk: 'critical' });
    await userEvent.click(screen.getAllByRole('tab')[1]);

    expect(screen.getByText('Auto Analysis')).toBeInTheDocument();
    // Summary text shows both in the RollingSummaryCard and the WindowCard.
    expect(screen.getAllByText(/Heavy AI-tool usage/).length).toBeGreaterThan(0);
    // Breakdown modality labels present (auto-expanded since latest)
    expect(screen.getByText('Apps')).toBeInTheDocument();
    expect(screen.getByText('Keystrokes')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
    // Correlations + timeline note
    expect(screen.getByText(/Paste burst followed app switch/)).toBeInTheDocument();
    expect(screen.getByText(/Spike right after the coding question/)).toBeInTheDocument();

    // Expand a ModalityCard to reveal its signals/evidence/summary
    await userEvent.click(screen.getByText('Apps'));
    expect(screen.getByText('AI tool foreground')).toBeInTheDocument();
    expect(screen.getAllByText("Signals").length).toBeGreaterThan(0);
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT window visible')).toBeInTheDocument();
  });

  test('Analysis tab groups consecutive same-risk windows; group header toggles the collapse', async () => {
    const results = [
      win({ risk: 'low', score: 10, processed_at: '2026-07-05T10:00:00Z', per_modality: { app_metadata: modality({ signals: ['s1'] }) } }),
      win({ risk: 'low', score: 20, processed_at: '2026-07-05T10:00:30Z', per_modality: { keystroke: modality({ signals: ['s1', 's2'] }) } }),
      win({ risk: 'low', score: 30, processed_at: '2026-07-05T10:01:00Z' }),
      win({ risk: 'high', score: 90, processed_at: '2026-07-05T10:01:30Z' }),
    ];
    renderPanel({ results, latestResult: results[3], averageScore: 40, recentScore: 47, highestRisk: 'high' });
    await userEvent.click(screen.getAllByRole('tab')[1]);

    // Rolling summary shows a rising trend (prior 10 → recent ~47)
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText(/Rising/)).toBeInTheDocument();

    // The multi-window low group header ("3 windows · …") is collapsed initially
    const header = screen.getByText(/3 windows/);
    expect(header).toBeInTheDocument();
    // Toggle it open then closed
    await userEvent.click(header);
    await userEvent.click(header);
  });

  test('RollingSummaryCard reflects a declining trend', async () => {
    const results = [
      win({ risk: 'high', score: 90, processed_at: '2026-07-05T10:00:00Z' }),
      win({ risk: 'high', score: 85, processed_at: '2026-07-05T10:00:30Z' }),
      win({ risk: 'high', score: 80, processed_at: '2026-07-05T10:01:00Z' }),
      win({ risk: 'low', score: 20, processed_at: '2026-07-05T10:01:30Z' }),
      win({ risk: 'low', score: 15, processed_at: '2026-07-05T10:02:00Z' }),
      win({ risk: 'low', score: 10, processed_at: '2026-07-05T10:02:30Z' }),
    ];
    renderPanel({ results, latestResult: results[5], highestRisk: 'high' });
    await userEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByText(/Declining/)).toBeInTheDocument();
  });

  // ── Image Analysis tab ──

  test('Image Analysis tab empty state', async () => {
    renderPanel();
    await userEvent.click(screen.getAllByRole('tab')[2]);
    expect(screen.getByText('No screenshots yet')).toBeInTheDocument();
  });

  test('Image Analysis tab renders cards and opens the lightbox from a thumbnail', async () => {
    const ia = imageResult({
      risk: 'high',
      score: 72,
      summary: 'Second monitor detected in frame.',
      image_count: 3,
      image_signals: ['second_monitor', 'phone_visible'],
      thumbnail_urls: ['a.png', 'b.png', 'c.png'],
    });
    const { container } = renderPanel({ imageAnalysisResults: [ia], latestImageAnalysis: ia });
    await userEvent.click(screen.getAllByRole('tab')[2]);

    expect(screen.getByText('Second monitor detected in frame.')).toBeInTheDocument();
    expect(screen.getByText('3 images')).toBeInTheDocument();
    expect(screen.getByText('Second Monitor')).toBeInTheDocument();
    expect(screen.getByText('Phone Visible')).toBeInTheDocument();

    // Thumbnails are decorative <img alt=""> → query the DOM directly.
    const thumbs = Array.from(container.querySelectorAll('img'));
    expect(thumbs.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(thumbs[0]);

    // Lightbox opened → counter "1 / 3"
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  test('lightbox navigates next/prev and closes', async () => {
    const ia = imageResult({ thumbnail_urls: ['a.png', 'b.png', 'c.png'] });
    const { container } = renderPanel({ imageAnalysisResults: [ia], latestImageAnalysis: ia });
    await userEvent.click(screen.getAllByRole('tab')[2]);
    const thumbs = Array.from(container.querySelectorAll('img'));
    await userEvent.click(thumbs[0]);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Next arrow (›)
    await userEvent.click(screen.getByText('›'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    // Prev arrow (‹)
    await userEvent.click(screen.getByText('‹'));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Keyboard navigation
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Escape closes
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
  });

  test('lightbox closes when the backdrop close button is clicked', async () => {
    const ia = imageResult({ thumbnail_urls: ['a.png', 'b.png'] });
    const { container } = renderPanel({ imageAnalysisResults: [ia], latestImageAnalysis: ia });
    await userEvent.click(screen.getAllByRole('tab')[2]);
    const thumbs = Array.from(container.querySelectorAll('img'));
    await userEvent.click(thumbs[0]);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();
  });

  // ── Alerts (Pulse) tab ──

  test('Alerts tab renders PulseAlertBanner content when alerts exist', () => {
    const alerts: PulseAlert[] = [
      {
        timestamp: '2026-07-05T10:00:00Z',
        detections: [
          { categoryId: 'ai_tools', categoryLabel: 'AI Tools', apps: ['ChatGPT'], matchedKeywords: ['gpt'] },
        ],
        activities: ['clipboard_paste', 'clipboard_paste'],
        keyboardAlerts: [
          { type: 'screenshot', label: 'Screenshot taken', riskLevel: 'HIGH' },
        ],
      },
    ];
    renderPanel({ pulseAlerts: alerts });
    // Alerts tab is the default (activeTab 0)
    expect(screen.getByText('AI Tools')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Paste Detected')).toBeInTheDocument();
    expect(screen.getByText('Screenshot taken')).toBeInTheDocument();
    // Badge count on the Alerts tab ("1") also appears as an app-count badge,
    // so assert presence rather than uniqueness.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  // ── Transcript tab ──

  test('Transcript tab empty hint depends on transcriptionOn', async () => {
    renderPanel({}, { transcriptionOn: true });
    await userEvent.click(screen.getAllByRole('tab')[3]);
    expect(screen.getByText(/Listening — speak to see transcription/)).toBeInTheDocument();
  });

  test('Transcript tab renders grouped interviewer/candidate bubbles + typing indicator', async () => {
    const fragments = [
      fragment({ speaker_role: 'candidate', text: 'I use the terminal a lot', timestamp: '2026-07-05T10:00:00Z' }),
      fragment({ speaker_role: 'candidate', text: 'mostly for git', timestamp: '2026-07-05T10:00:05Z' }),
      fragment({ speaker_role: 'interviewer', text: 'Great, walk me through it', timestamp: '2026-07-05T10:00:10Z' }),
      fragment({ speaker_role: 'interviewer', text: 'typing', is_final: false, timestamp: '2026-07-05T10:00:15Z' }),
    ];
    renderPanel({ transcriptFragments: fragments }, { transcriptionOn: true });
    await userEvent.click(screen.getAllByRole('tab')[3]);

    expect(screen.getByText('Candidate')).toBeInTheDocument();
    expect(screen.getByText('Interviewer')).toBeInTheDocument();
    expect(screen.getByText('I use the terminal a lot')).toBeInTheDocument();
    expect(screen.getByText('mostly for git')).toBeInTheDocument();
    // Interim (non-final) fragment shows the typing indicator
    expect(screen.getByLabelText('typing')).toBeInTheDocument();
    // The transcript tab badge counts finalized fragments (3)
    const transcriptTab = screen.getAllByRole('tab')[3];
    expect(within(transcriptTab).getByText('3')).toBeInTheDocument();
  });

  test('fragments with a missing speaker_role default to the candidate side', async () => {
    const fragments = [fragment({ speaker_role: undefined, text: 'no role here' })];
    renderPanel({ transcriptFragments: fragments }, { transcriptionOn: true });
    await userEvent.click(screen.getAllByRole('tab')[3]);
    expect(screen.getByText('Candidate')).toBeInTheDocument();
    expect(screen.getByText('no role here')).toBeInTheDocument();
  });
});
