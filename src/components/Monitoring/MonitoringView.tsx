/**
 * MonitoringView — Skyview interviewer monitoring page (extension-type interviews)
 *
 * Renders inside AppLayout's <Outlet />. The Skyview sidebar stays open on
 * the left (handled by AppLayout). This component fills the main area:
 *   - Top header: interview title, candidate name, status, exit button
 *   - Below: AnalyticsPanel (ported from Falcon) — contains the three tabs
 *     (Pulse / Window Analysis / Screenshots) plus Start/Stop monitoring buttons
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useRiskSocket } from '../../hooks/useRiskSocket';
import { useHelper } from '../../hooks/useHelper';
import { openSettingsPane, requestHelperPermission } from '../../services/helperBridge';
import { InterviewService } from '../../services/interview.service';
import { ENV } from '../../config/env';
import { STORAGE_KEYS } from '../../config/constants';
import HelperDownloadCard from './HelperDownloadCard';
import type { InterviewSession } from '../../types/interview.types';
import { USER_ROLES, isStaffRole } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import AnalyticsPanel from './AnalyticsPanel';
import CandidateSetupCard from './CandidateSetupCard';
import InterviewerSetupCard from './InterviewerSetupCard';
import FalconDownloadCard from '../common/FalconDownloadCard';
import { TOKENS } from '../../theme';

const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;
const BRAND = TOKENS.brand;

export default function MonitoringView() {
  const { id: interviewId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const riskData = useRiskSocket(interviewId ?? null);
  const helper = useHelper(2000);

  // Toggle state is server-authoritative now (Bug 12 fix). Cortex
  // broadcasts modality-state on every change AND on join — so multiple
  // tabs + reconnects stay in sync. We derive transcriptionOn/analysisOn
  // from riskData.modalityState; sessionStorage is retained only as an
  // "intent" fallback used to re-emit on first connect when Cortex has
  // no prior state for this session (e.g., fresh mount after full
  // session end). The server's response to our emit immediately supersedes
  // the fallback via the next modality-state event.
  const transcriptionOn = riskData.modalityState?.transcription ?? false;
  const analysisOn = riskData.modalityState?.analysis ?? false;

  // Cortex is the single authority on session lifecycle. On mount we
  // flip SCHEDULED → ACTIVE; a 10s heartbeat refreshes a Redis TTL;
  // unmount / beforeunload flips ACTIVE → COMPLETED so the daemon stops.
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await InterviewService.activate(interviewId);
        if (cancelled) return;
        if (res.success) {
          setActivated(true);
          setActivateError(null);
        } else {
          setActivateError(res.message || 'Unable to start session');
        }
      } catch (err: any) {
        if (cancelled) return;
        // 409: session COMPLETED/CANCELLED beyond reload-grace. 404: session
        // gone. 401: stale JWT (refresh path already tried). Anything
        // else: network / server error. In all cases Skyview can't
        // meaningfully drive this session — surface it and redirect.
        const msg =
          err?.data?.error ||
          err?.message ||
          'Unable to start session';
        console.warn('[MonitoringView] activate failed', err);
        setActivateError(msg);
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId]);

  // If activate failed, hold the user on an error screen for a moment
  // then send them back to the list. This replaces the old silent-fail
  // behavior (toggles appearing functional but doing nothing).
  useEffect(() => {
    if (!activateError) return;
    const id = window.setTimeout(() => navigate('/interviews'), 3000);
    return () => window.clearTimeout(id);
  }, [activateError, navigate]);

  useEffect(() => {
    if (!interviewId || !activated) return;
    const id = window.setInterval(async () => {
      try {
        const res = await InterviewService.heartbeat(interviewId);
        // Cortex now returns the session's current status on every beat.
        // If it drifted to COMPLETED/CANCELLED (other tab's deactivate,
        // scheduled-end cleanup, admin override), bail — there's nothing
        // useful this page can do any more.
        const status = res?.data?.status;
        if (status && status !== 'ACTIVE') {
          console.info(`[MonitoringView] session ${status} — redirecting out`);
          navigate('/interviews');
        }
      } catch {/* transient failure — try again next tick */}
    }, 10_000);
    return () => window.clearInterval(id);
  }, [interviewId, activated, navigate]);

  useEffect(() => {
    if (!interviewId) return;
    // fetch keepalive lets POST outlive the tab; sendBeacon can't send
    // Authorization headers so it's a poor fit for an authenticated route.
    const beaconDeactivate = () => {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
      try {
        fetch(`${ENV.AUTH_API_URL}/interview-sessions/${interviewId}/deactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: '{}',
          keepalive: true,
        });
      } catch {/* ignore */}
    };
    window.addEventListener('beforeunload', beaconDeactivate);
    return () => {
      window.removeEventListener('beforeunload', beaconDeactivate);
      InterviewService.deactivate(interviewId).catch(() => {});
    };
  }, [interviewId]);

  // Re-emit intent on (re)connect if Cortex tells us the session has no
  // active modality but we locally want it on. This covers:
  //   • Tab refresh — Cortex's in-memory modality may have been cleared
  //     by the beforeunload deactivate; after reload we want to restore.
  //   • Fresh tab opening mid-session — catch-up from Cortex already
  //     lands on first connect, no action needed here.
  // Intent is stored in sessionStorage (since we removed local state).
  useEffect(() => {
    if (!interviewId || !riskData.isConnected || !activated) return;
    if (!riskData.modalityState) return; // wait for canonical state
    const wantTxn = sessionStorage.getItem(`skyview:txn:${interviewId}`) === '1';
    const wantAnl = sessionStorage.getItem(`skyview:anl:${interviewId}`) === '1';
    if (wantTxn && !riskData.modalityState.transcription) {
      riskData.emitStartTranscription();
    }
    if (wantAnl && !riskData.modalityState.analysis) {
      riskData.emitStartAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, riskData.isConnected, activated, riskData.modalityState]);

  // Fetch interview details
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await InterviewService.getById(interviewId);
        if (cancelled) return;
        if (response.success && response.data) {
          setInterview(response.data);
          // Seed candidateStatus from the persisted extension_status so the
          // checklist renders correctly even if we open this page after the
          // candidate has already finished setup. Live updates from the
          // socket will overwrite this once they arrive.
          if (response.data.extension_status) {
            riskData.setInitialCandidateStatus({
              extension_installed: !!response.data.extension_status.extension_installed,
              screen_recording: !!response.data.extension_status.screen_recording,
              mic_granted: !!response.data.extension_status.mic_granted,
              joined: !!response.data.extension_status.joined,
              updated_at: response.data.extension_status.updated_at ?? null,
            });
          }
        } else {
          setError(response.message || 'Failed to load interview');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load interview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // riskData.setInitialCandidateStatus is a stable useCallback ref — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // Bind the interviewer's helper to this session once it's loaded.
  // Helper → Cortex, runs preflight, mic-only mode. Replaces the
  // Chrome-extension handshake entirely.
  //
  // Rejoin condition: NOT bound yet, OR bound but the Cortex socket has
  // dropped (connected=false). The daemon gives up after 5 reconnect
  // attempts — if Cortex was restarting or network flapped during that
  // window, the daemon sits zombie with a session_id but no live socket.
  // Without the `connected` check here we'd never tell it to respawn,
  // so toggles and scheduler ticks never reach it.
  useEffect(() => {
    if (!interviewId || !helper.installed || !user || !interview) return;
    const alreadyBoundAndLive =
      helper.status?.session_id === interviewId &&
      helper.status?.connected === true;
    if (alreadyBoundAndLive) return;

    const interviewerPartId = interview.interview_session_participants?.find(
      (p) => p.interviewer_id === user.id
    )?.id;
    if (!interviewerPartId) return;

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
    if (!token) return;

    helper.join({
      session_id: interviewId,
      participant_id: interviewerPartId,
      role: 'interviewer',
      token,
      cortex_url: ENV.AUTH_API_URL,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, helper.installed, helper.status?.session_id, helper.status?.connected, user, interview]);

  // Toggle handlers: emit the socket event AND record intent in
  // sessionStorage so a subsequent reload / reconnect can restore. The
  // UI itself re-renders on the server's modality-state broadcast, not
  // on local state.
  const handleToggleTranscription = (next: boolean) => {
    if (interviewId) {
      sessionStorage.setItem(`skyview:txn:${interviewId}`, next ? '1' : '0');
    }
    if (next) riskData.emitStartTranscription();
    else riskData.emitStopTranscription();
  };

  const handleToggleAnalysis = (next: boolean) => {
    if (interviewId) {
      sessionStorage.setItem(`skyview:anl:${interviewId}`, next ? '1' : '0');
    }
    if (next) riskData.emitStartAnalysis();
    else riskData.emitStopAnalysis();
  };

  const handleExit = () => {
    if (transcriptionOn) riskData.emitStopTranscription();
    if (analysisOn) riskData.emitStopAnalysis();
    if (interviewId) {
      sessionStorage.setItem(`skyview:txn:${interviewId}`, '0');
      sessionStorage.setItem(`skyview:anl:${interviewId}`, '0');
    }
    navigate('/interviews');
  };

  // Back-compat "monitoring active" signal = either toggle on. Used only
  // by the status chip + AnalyticsPanel's header dot.
  const isMonitoring = transcriptionOn || analysisOn;

  // Permission check: only staff (Owner / Admin / Member) should reach this view
  useEffect(() => {
    if (!isStaffRole(userRole)) {
      navigate('/', { replace: true });
    }
  }, [userRole, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: BRAND }} />
      </Box>
    );
  }

  if (error || !interview) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Interview not found'}</Alert>
      </Box>
    );
  }

  if (activateError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {activateError} — redirecting to your interviews...
        </Alert>
      </Box>
    );
  }

  // Resolve candidate name from participants
  const candidateParticipant = interview.interview_session_participants?.find(
    (p) => p.candidate_id && p.candidate
  );
  const candidateName = candidateParticipant?.candidate
    ? `${candidateParticipant.candidate.first_name} ${candidateParticipant.candidate.last_name}`.trim()
    : 'Candidate';


  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: LIGHT_BG,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderBottom: `1px solid ${LIGHT_BORDER}`,
          bgcolor: LIGHT_BG,
          color: '#1F2937',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <IconButton
          onClick={handleExit}
          size="small"
          sx={{
            color: '#6B7280',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', color: '#1F2937' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h3"
            sx={{
              color: '#1F2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {interview.title}
          </Typography>
          <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' }, color: '#6B7280' }}>
            {helper.installed && helper.status?.microphone_ok
              ? `${candidateName} · ${interview.interview_type === 'extension' ? 'Trueyy Helper' : 'Falcon App'}`
              : 'Setup your monitoring before joining'}
          </Typography>
        </Box>

        {/* Connection / monitoring status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Chip
            icon={<DotIcon sx={{ fontSize: '12px !important' }} />}
            label={riskData.isConnected ? 'Connected' : 'Disconnected'}
            size="small"
            sx={{
              height: 24,
              fontWeight: 600,
              bgcolor: riskData.isConnected ? 'rgba(76, 217, 100, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: riskData.isConnected ? BRAND : '#ef4444',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          {isMonitoring && (
            <Chip
              icon={<DotIcon sx={{ fontSize: '12px !important' }} />}
              label="Monitoring"
              size="small"
              sx={{
                height: 24,
                fontWeight: 600,
                bgcolor: 'rgba(76, 217, 100, 0.15)',
                color: BRAND,
                '& .MuiChip-icon': {
                  color: BRAND,
                  animation: 'pulse 1.5s ease-in-out infinite',
                },
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
          )}
          {/* "Open meeting link" moved to AnalyticsPanel header next to
              Capture / Start / Stop so all interviewer actions live in
              one toolbar. */}
        </Box>
      </Box>

      {interview.interview_type === 'application' ? (
        <FalconDownloadCard />
      ) : (
        /* Extension-type: full monitoring UI */
        <>
          {/* Pre-join checklists */}
          {!riskData.candidateStatus?.joined
            ? <CandidateSetupCard status={riskData.candidateStatus} />
            : !riskData.candidateStatus?.screen_recording
              ? <CandidateSetupCard status={riskData.candidateStatus} revoked />
              : null
          }

          {/* Interviewer helper setup — show download card until the
              local Trueyy Helper daemon is reachable + mic permission
              is granted. Once ready, hide the card and render Risk
              Analytics below. */}
          {!helper.installed ? (
            <HelperDownloadCard checking={helper.checking} onRetry={() => helper.refresh()} />
          ) : !helper.status?.microphone_ok ? (
            <InterviewerSetupCard
              installed={helper.installed}
              micGranted={!!helper.status?.microphone_ok}
              checking={helper.checking}
              // Same auto-flow the candidate side uses: register the
              // helper with TCC + open System Settings → Microphone in
              // one click. Falls back to plain "open settings" if the
              // request endpoint isn't available (older helper builds).
              onEnableMic={async () => {
                const ok = await requestHelperPermission('microphone');
                if (!ok) await openSettingsPane('microphone');
                helper.refresh();
              }}
              onRetryMic={() => helper.refresh()}
            />
          ) : null}

          {/* AnalyticsPanel — shown once the helper reports mic granted. */}
          {helper.installed && helper.status?.microphone_ok && (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <AnalyticsPanel
                interview={interview}
                riskData={riskData}
                isMonitoring={isMonitoring}
                transcriptionOn={transcriptionOn}
                analysisOn={analysisOn}
                onToggleTranscription={handleToggleTranscription}
                onToggleAnalysis={handleToggleAnalysis}
                onClose={handleExit}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
