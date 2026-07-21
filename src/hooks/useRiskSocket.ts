import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ENV } from '../config/env';

export interface ModalityRisk {
  risk_level: string;
  risk_score: number;
  signals: string[];
  summary: string;
  evidence: string[];
}

export interface Correlation {
  finding: string;
  signals_involved: string[];
  impact: 'weak' | 'moderate' | 'strong';
}

export interface WindowResult {
  window_id: string;
  session_id: string;
  risk: string;
  score: number;
  summary: string;
  confidence?: string;
  status: string;
  processed_at: string;
  per_modality?: {
    app_metadata?: ModalityRisk;
    keystroke?: ModalityRisk;
    voice?: ModalityRisk;
  };
  correlations?: Correlation[];
  timeline_note?: string;
}

export interface ImageAnalysisResult {
  analysis_id: string;
  session_id: string;
  status: string;
  risk: string;
  score: number;
  summary: string;
  image_count: number;
  processed_at: string;
  image_signals: string[];
  image_evidence: string[];
  thumbnail_urls: string[];
  per_image?: { index: number; bullets: string[] }[];
}

export interface PulseAppInfo {
  app_name: string;
  window_title: string;
  is_excluded: boolean;
}

export interface PulseDetection {
  categoryId: string;
  categoryLabel: string;
  apps: string[];
  /** Per-app detail: app name + window title + hidden-from-recording flag. */
  appInfos?: PulseAppInfo[];
  matchedKeywords: string[];
}

/** Discrete keyboard alert — shown every occurrence (no dedup). */
export interface KeyboardAlert {
  type: string;
  label: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  key?: string;
  app?: string;
  fromApp?: string;
  toApp?: string;
  count?: number;
}

export interface PulseAlert {
  detections: PulseDetection[];
  activities: string[];
  keyboardAlerts?: KeyboardAlert[];
  timestamp: string;
}

export interface TranscriptFragment {
  text: string;
  is_final: boolean;
  timestamp: string;
  // Populated by the Cortex Deepgram proxy for both interviewer and
  // candidate streams. Older payloads (pre-Phase 2) omit these — treat a
  // missing role as "candidate" to match the original Falcon flow.
  speaker_role?: "interviewer" | "candidate";
  participant_id?: string;
  start_ms?: number;
  end_ms?: number;
}

export interface CandidateStatus {
  extension_installed: boolean;
  screen_recording: boolean;
  mic_granted: boolean;
  keyboard_granted: boolean;
  joined: boolean;
  updated_at: string | null;
}

// InterviewerStatus removed: the interviewer no longer runs a local
// helper for the dual-transcription flow (their voice arrives via the
// candidate-side SystemAudioCapture stream), so the interviewer-status
// socket event has no UI consumer.

/**
 * Canonical modality state for the current session, as reported by
 * Cortex. Broadcast to every socket in the session room on every
 * start-/stop- change AND on join-session — which is how multi-tab /
 * reconnect scenarios stay in sync without each tab holding its own
 * divergent view of the toggle state.
 */
export interface ModalityState {
  transcription: boolean;
  analysis: boolean;
}

export interface UseRiskSocketReturn {
  results: WindowResult[];
  latestResult: WindowResult | null;
  averageScore: number;
  recentScore: number;
  highestRisk: string;
  isConnected: boolean;
  pulseAlerts: PulseAlert[];
  transcriptFragments: TranscriptFragment[];
  imageAnalysisResults: ImageAnalysisResult[];
  latestImageAnalysis: ImageAnalysisResult | null;
  isImageAnalysisProcessing: boolean;
  pendingImageAnalysisCount: number;
  incrementPendingImageAnalysis: (count: number) => void;
  // Capture remains one-shot — interviewer clicks "Capture" to grab
  // screenshots on demand. Unlike pulse/window, it doesn't have a
  // continuous lifecycle.
  emitCaptureScreenshots: () => void;
  // Lifecycle toggles: voice transcription is continuous while enabled;
  // analysis drives Cortex's 5s pulse + 30s window timers.
  emitStartTranscription: () => void;
  emitStopTranscription: () => void;
  emitStartAnalysis: () => void;
  emitStopAnalysis: () => void;
  // Server-authoritative toggle state. Null until the first
  // modality-state event lands (join-session catch-up).
  modalityState: ModalityState | null;
  // Pre-join setup state pushed by the candidate's Jarvis extension. Null
  // means we haven't received any status yet (e.g. extension never connected
  // for this session, or it's an application-type interview).
  candidateStatus: CandidateStatus | null;
  /** Candidate consent lifecycle (GDPR) — seeded from the session payload,
   *  updated live via the consent-status socket event. */
  consentStatus: { status: 'given' | 'declined' | 'revoked'; at: string } | null;
  setInitialConsentStatus: (status: { status: 'given' | 'declined' | 'revoked'; at: string } | null) => void;
  setInitialCandidateStatus: (status: CandidateStatus | null) => void;
}

// ── Merge helpers: combine fetched history with live socket data, dedup, sort ──
const byTime = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();

function mergeResults(a: WindowResult[], b: WindowResult[]): WindowResult[] {
  const map = new Map<string, WindowResult>();
  // Live entries (added later) win over historical ones for the same window.
  for (const r of [...a, ...b]) map.set(r.window_id, r);
  return [...map.values()].sort((x, y) => byTime(x.processed_at, y.processed_at));
}

function mergeImageResults(a: ImageAnalysisResult[], b: ImageAnalysisResult[]): ImageAnalysisResult[] {
  const map = new Map<string, ImageAnalysisResult>();
  for (const r of [...a, ...b]) map.set(r.analysis_id, r);
  return [...map.values()].sort((x, y) => byTime(x.processed_at, y.processed_at));
}

function mergePulse(a: PulseAlert[], b: PulseAlert[]): PulseAlert[] {
  const seen = new Set<string>();
  const out: PulseAlert[] = [];
  for (const p of [...a, ...b].sort((x, y) => byTime(x.timestamp, y.timestamp))) {
    if (seen.has(p.timestamp)) continue;
    seen.add(p.timestamp);
    out.push(p);
  }
  return out;
}

function mergeTranscript(history: TranscriptFragment[], current: TranscriptFragment[]): TranscriptFragment[] {
  const key = (f: TranscriptFragment) => `${f.speaker_role}|${f.timestamp}|${f.text}`;
  const have = new Set(current.filter(f => f.is_final).map(key));
  const fresh = history.filter(h => !have.has(key(h)));
  return [...fresh, ...current].sort((x, y) => byTime(x.timestamp, y.timestamp));
}

function getRiskPriority(risk: string): number {
  switch (risk.toLowerCase()) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export function useRiskSocket(sessionId: string | null): UseRiskSocketReturn {
  const [results, setResults] = useState<WindowResult[]>([]);
  const [pulseAlerts, setPulseAlerts] = useState<PulseAlert[]>([]);
  const [transcriptFragments, setTranscriptFragments] = useState<TranscriptFragment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [imageAnalysisResults, setImageAnalysisResults] = useState<ImageAnalysisResult[]>([]);
  const [pendingImageAnalysisCount, setPendingImageAnalysisCount] = useState(0);
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus | null>(null);
  const [modalityState, setModalityState] = useState<ModalityState | null>(null);
  // Consent lifecycle (GDPR): null until the first event or initial seed;
  // MonitoringView seeds it from the session payload's has_open_consent.
  const [consentStatus, setConsentStatus] = useState<{ status: 'given' | 'declined' | 'revoked'; at: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const setInitialConsentStatus = useCallback((status: { status: 'given' | 'declined' | 'revoked'; at: string } | null) => {
    setConsentStatus((prev) => prev ?? status);
  }, []);

  const setInitialCandidateStatus = useCallback((status: CandidateStatus | null) => {
    setCandidateStatus((prev) => prev ?? status);
  }, []);

  const isImageAnalysisProcessing = pendingImageAnalysisCount > 0;

  const incrementPendingImageAnalysis = useCallback((count: number) => {
    setPendingImageAnalysisCount(prev => prev + count);
  }, []);

  const emitCaptureScreenshots = useCallback(() => {
    socketRef.current?.emit('capture-screenshots', sessionId);
  }, [sessionId]);
  const emitStartTranscription = useCallback(() => {
    socketRef.current?.emit('start-transcription', sessionId);
  }, [sessionId]);
  const emitStopTranscription = useCallback(() => {
    socketRef.current?.emit('stop-transcription', sessionId);
  }, [sessionId]);
  const emitStartAnalysis = useCallback(() => {
    socketRef.current?.emit('start-analysis', sessionId);
  }, [sessionId]);
  const emitStopAnalysis = useCallback(() => {
    socketRef.current?.emit('stop-analysis', sessionId);
  }, [sessionId]);

  const latestResult = results.length > 0 ? results[results.length - 1] : null;

  const averageScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;

  // Recent score: average of windows from the last 5 minutes
  const recentScore = (() => {
    if (results.length === 0) return 0;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recent = results.filter(r => new Date(r.processed_at).getTime() > fiveMinAgo);
    if (recent.length === 0) {
      // If no results in last 5 min, use the last 3 results as fallback
      const last3 = results.slice(-3);
      return Math.round(last3.reduce((sum, r) => sum + r.score, 0) / last3.length);
    }
    return Math.round(recent.reduce((sum, r) => sum + r.score, 0) / recent.length);
  })();

  const highestRisk = results.length > 0
    ? results.reduce((highest, r) =>
        getRiskPriority(r.risk) > getRiskPriority(highest) ? r.risk : highest,
      'low')
    : 'none';

  const latestImageAnalysis = imageAnalysisResults.length > 0
    ? imageAnalysisResults[imageAnalysisResults.length - 1]
    : null;

  const handleWindowResult = useCallback((result: WindowResult) => {
    console.log('[RiskSocket] Window result received:', result);
    setResults(prev => mergeResults(prev, [result]));
  }, []);

  const handleImageAnalysisResult = useCallback((result: ImageAnalysisResult) => {
    console.log('[RiskSocket] Image analysis result received:', result);
    setImageAnalysisResults(prev => mergeImageResults(prev, [result]));
    setPendingImageAnalysisCount(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    // Pass our JWT as socket auth so Cortex's new middleware can
    // identify the user. In dev Cortex lets anonymous through; in
    // production it rejects, so this is the auth path for both.
    // client: "skyview" lets Cortex distinguish us from daemon sockets
    // (Trueyy Helper, Sentinel) — only Skyview disconnects trigger session
    // teardown, and only when the last Skyview tab leaves.
    // Function form so socket.io re-reads the (proactively-refreshed) token on
    // every connect/reconnect instead of capturing a stale one at mount.
    const socket = io(ENV.AUTH_API_URL, {
      transports: ['websocket', 'polling'],
      auth: (cb: (data: Record<string, unknown>) => void) =>
        cb({ client: 'skyview', token: localStorage.getItem('auth_access_token') || '' }),
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[RiskSocket] Connected');
      setIsConnected(true);
      socket.emit('join-session', sessionId);
    });

    socket.on('disconnect', () => {
      console.log('[RiskSocket] Disconnected');
      setIsConnected(false);
    });

    socket.on('window-result', handleWindowResult);

    socket.on('image-analysis-result', handleImageAnalysisResult);

    socket.on('risk-pulse', (data: PulseAlert) => {
      console.log('[RiskSocket] Pulse alert received:', data);
      setPulseAlerts(prev => mergePulse(prev, [data]));
    });

    // Pre-join setup state from candidate's extension. Cortex broadcasts
    // the merged state on every update so we can just overwrite — no
    // partial-merge logic needed here.
    socket.on('candidate-status', (data: { sessionId: string } & CandidateStatus) => {
      console.log('[RiskSocket] candidate-status received:', data);
      setCandidateStatus({
        extension_installed: !!data.extension_installed,
        screen_recording: !!data.screen_recording,
        mic_granted: !!data.mic_granted,
        keyboard_granted: !!data.keyboard_granted,
        joined: !!data.joined,
        updated_at: data.updated_at ?? new Date().toISOString(),
      });
    });

    // Candidate consent transitions — Cortex broadcasts on grant/decline/
    // revoke. Revoke also triggers stop-transcription/analysis broadcasts;
    // this event is what drives the interviewer banner + toggle lock.
    socket.on('consent-status', (data: { sessionId: string; status: 'given' | 'declined' | 'revoked'; at: string }) => {
      console.log('[RiskSocket] consent-status received:', data);
      setConsentStatus({ status: data.status, at: data.at });
    });

    // interviewer-status subscription removed — see comment near the top
    // of the file. Cortex may still emit this event for legacy clients,
    // but Skyview ignores it.

    socket.on(
      'modality-state',
      (data: { sessionId: string } & ModalityState) => {
        console.log('[RiskSocket] modality-state received:', data);
        setModalityState({
          transcription: !!data.transcription,
          analysis: !!data.analysis,
        });
      }
    );

    socket.on('live-transcript', (data: TranscriptFragment) => {
      // Normalize missing speaker_role to "candidate" to keep the pre-Phase-2
      // Falcon flow working unchanged.
      const incoming: TranscriptFragment = {
        ...data,
        speaker_role: data.speaker_role ?? 'candidate',
      };
      setTranscriptFragments(prev => {
        // Interim replacement must be per-speaker now that both interviewer
        // and candidate push fragments concurrently — otherwise the
        // candidate's in-progress utterance gets clobbered by the
        // interviewer's and vice versa.
        for (let i = prev.length - 1; i >= 0; i--) {
          const f = prev[i];
          if (f.speaker_role === incoming.speaker_role) {
            if (!f.is_final) {
              return [...prev.slice(0, i), incoming, ...prev.slice(i + 1)];
            }
            break;
          }
        }
        return [...prev, incoming];
      });
    });

    return () => {
      socket.emit('leave-session', sessionId);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [sessionId, handleWindowResult, handleImageAnalysisResult]);

  // Rehydrate all four live-monitoring tabs from Cortex on mount / session
  // change. Without this, a page refresh wipes the socket-only state and the
  // panels go empty mid-interview. We merge (not replace) so any live event
  // that lands while these fetches are in flight is preserved, and everything
  // stays deduped + chronological.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const base = `${ENV.AUTH_API_URL}/interview-sessions/${sessionId}`;
    const token = localStorage.getItem('auth_access_token') || '';
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const getJson = (url: string) =>
      fetch(url, { headers }).then(r => (r.ok ? r.json() : null)).catch(() => null);

    // Window analysis tab
    getJson(`${base}/windows`).then(json => {
      if (cancelled || !json?.data?.results) return;
      setResults(prev => mergeResults(json.data.results as WindowResult[], prev));
    });

    // Image analysis tab
    getJson(`${base}/image-analysis`).then(json => {
      if (cancelled || !json?.data?.results) return;
      setImageAnalysisResults(prev => mergeImageResults(json.data.results as ImageAnalysisResult[], prev));
    });

    // Pulse tab
    getJson(`${base}/pulse-events`).then(json => {
      if (cancelled || !json?.data?.results) return;
      setPulseAlerts(prev => mergePulse(json.data.results as PulseAlert[], prev));
    });

    // Transcription tab
    getJson(`${base}/transcript`).then(json => {
      if (cancelled || !json?.data?.utterances) return;
      const history: TranscriptFragment[] = (json.data.utterances as Array<{
        text: string; speaker_role: string; participant_id?: string;
        start_ms?: number | null; end_ms?: number | null; captured_at: string;
      }>).map(u => ({
        text: u.text,
        is_final: true,
        timestamp: u.captured_at,
        speaker_role: u.speaker_role === 'interviewer' ? 'interviewer' : 'candidate',
        participant_id: u.participant_id,
        start_ms: u.start_ms ?? undefined,
        end_ms: u.end_ms ?? undefined,
      }));
      setTranscriptFragments(prev => mergeTranscript(history, prev));
    });

    return () => { cancelled = true; };
  }, [sessionId]);

  return {
    results,
    latestResult,
    averageScore,
    recentScore,
    highestRisk,
    isConnected,
    pulseAlerts,
    transcriptFragments,
    imageAnalysisResults,
    latestImageAnalysis,
    isImageAnalysisProcessing,
    pendingImageAnalysisCount,
    incrementPendingImageAnalysis,
    emitCaptureScreenshots,
    emitStartTranscription,
    emitStopTranscription,
    emitStartAnalysis,
    emitStopAnalysis,
    modalityState,
    candidateStatus,
    consentStatus,
    setInitialConsentStatus,
    setInitialCandidateStatus,
  };
}
