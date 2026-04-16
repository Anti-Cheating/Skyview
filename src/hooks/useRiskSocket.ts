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
}

export interface PulseDetection {
  categoryId: string;
  categoryLabel: string;
  apps: string[];
  matchedKeywords: string[];
}

export interface PulseAlert {
  detections: PulseDetection[];
  activities: string[];
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
  joined: boolean;
  updated_at: string | null;
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
  // Remote monitoring control via Socket
  remoteStartRequested: boolean;
  remoteStopRequested: boolean;
  remoteCaptureRequested: boolean;
  resetRemoteStart: () => void;
  resetRemoteStop: () => void;
  resetRemoteCapture: () => void;
  emitStartMonitoring: () => void;
  emitStopMonitoring: () => void;
  emitCaptureScreenshots: () => void;
  // Pre-join setup state pushed by the candidate's Jarvis extension. Null
  // means we haven't received any status yet (e.g. extension never connected
  // for this session, or it's an application-type interview).
  candidateStatus: CandidateStatus | null;
  setInitialCandidateStatus: (status: CandidateStatus | null) => void;
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
  const [remoteStartRequested, setRemoteStartRequested] = useState(false);
  const [remoteStopRequested, setRemoteStopRequested] = useState(false);
  const [remoteCaptureRequested, setRemoteCaptureRequested] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Allow MonitoringView to seed the candidate status from the GET
  // /interview-sessions/:id payload (which now returns extension_status)
  // before any socket events arrive — so an interviewer who opens the
  // page after the candidate set up still sees the right state.
  const setInitialCandidateStatus = useCallback((status: CandidateStatus | null) => {
    setCandidateStatus((prev) => prev ?? status);
  }, []);

  const isImageAnalysisProcessing = pendingImageAnalysisCount > 0;

  const incrementPendingImageAnalysis = useCallback((count: number) => {
    setPendingImageAnalysisCount(prev => prev + count);
  }, []);

  const resetRemoteStart = useCallback(() => setRemoteStartRequested(false), []);
  const resetRemoteStop = useCallback(() => setRemoteStopRequested(false), []);
  const resetRemoteCapture = useCallback(() => setRemoteCaptureRequested(false), []);
  const emitStartMonitoring = useCallback(() => {
    socketRef.current?.emit('start-monitoring', sessionId);
  }, [sessionId]);
  const emitStopMonitoring = useCallback(() => {
    socketRef.current?.emit('stop-monitoring', sessionId);
  }, [sessionId]);
  const emitCaptureScreenshots = useCallback(() => {
    socketRef.current?.emit('capture-screenshots', sessionId);
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
    setResults(prev => [...prev, result]);
  }, []);

  const handleImageAnalysisResult = useCallback((result: ImageAnalysisResult) => {
    console.log('[RiskSocket] Image analysis result received:', result);
    setImageAnalysisResults(prev => [...prev, result]);
    setPendingImageAnalysisCount(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(ENV.AUTH_API_URL, {
      transports: ['websocket', 'polling'],
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
      setPulseAlerts(prev => [...prev, data]);
    });

    socket.on('remote-start-monitoring', () => {
      console.log('[RiskSocket] Remote start-monitoring received');
      setRemoteStartRequested(true);
    });

    socket.on('remote-stop-monitoring', () => {
      console.log('[RiskSocket] Remote stop-monitoring received');
      setRemoteStopRequested(true);
    });

    socket.on('remote-capture-screenshots', () => {
      console.log('[RiskSocket] Remote capture-screenshots received');
      setRemoteCaptureRequested(true);
    });

    // Pre-join setup state from candidate's extension. Cortex broadcasts
    // the merged state on every update so we can just overwrite — no
    // partial-merge logic needed here.
    socket.on('candidate-status', (data: { sessionId: string } & CandidateStatus) => {
      console.log('[RiskSocket] candidate-status received:', data);
      setCandidateStatus({
        extension_installed: !!data.extension_installed,
        screen_recording: !!data.screen_recording,
        joined: !!data.joined,
        updated_at: data.updated_at ?? new Date().toISOString(),
      });
    });

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
    remoteStartRequested,
    remoteStopRequested,
    remoteCaptureRequested,
    resetRemoteStart,
    resetRemoteStop,
    resetRemoteCapture,
    emitStartMonitoring,
    emitStopMonitoring,
    emitCaptureScreenshots,
    candidateStatus,
    setInitialCandidateStatus,
  };
}
