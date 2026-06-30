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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FiberManualRecord as DotIcon,
  StopCircleOutlined as EndIcon,
} from '@mui/icons-material';
import { useRiskSocket } from '../../hooks/useRiskSocket';
import { useHelper } from '../../hooks/useHelper';
import { InterviewService } from '../../services/interview.service';
import { ENV } from '../../config/env';
import { STORAGE_KEYS } from '../../config/constants';
import type { InterviewSession } from '../../types/interview.types';
import { USER_ROLES, isStaffRole } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';
import AnalyticsPanel from './AnalyticsPanel';
import CandidateSetupCard from './CandidateSetupCard';
import { TOKENS } from '../../theme';

const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;
const BRAND = TOKENS.brand;

export default function MonitoringView() {
  const { roundId } = useParams<{ roundId: string }>();
  const interviewId = roundId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

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
              keyboard_granted: !!response.data.extension_status.keyboard_granted,
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

  // Explicit, deliberate end — the primary "I'm done" action. Gated by a
  // confirm dialog so a misclick can't finalize a live interview. This
  // matters more now that a lapsed heartbeat no longer auto-ends sessions:
  // the interviewer's intentional click (or the scheduled-end deadline) is
  // the main path to COMPLETED. Stops both modalities, persists the
  // off-intent, fires an explicit /deactivate, then leaves.
  const handleEndInterview = () => {
    setEndDialogOpen(false);
    if (transcriptionOn) riskData.emitStopTranscription();
    if (analysisOn) riskData.emitStopAnalysis();
    if (interviewId) {
      sessionStorage.setItem(`skyview:txn:${interviewId}`, '0');
      sessionStorage.setItem(`skyview:anl:${interviewId}`, '0');
      InterviewService.deactivate(interviewId).catch(() => {});
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
      <Box
        role="status"
        aria-live="polite"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <CircularProgress sx={{ color: BRAND }} aria-label="Loading interview" />
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
          // Was unlabelled — exits the monitoring session and navigates
          // back to the interviews list. Spelling it out also tells the
          // user that this isn't a "browser back" — it actually ends
          // the session server-side.
          aria-label="Exit monitoring and return to interviews"
          sx={{
            color: '#6B7280',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', color: '#1F2937' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Page title rendered as a real <h1> so MonitoringView gets
              a single canonical page heading like every other route.
              The visual size from variant="h3" is preserved. */}
          <Typography
            component="h1"
            variant="h3"
            sx={{
              m: 0,
              color: '#1F2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {interview.title}
          </Typography>
          <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' }, color: '#6B7280' }}>
            {`${candidateName} · Trueyy Helper`}
          </Typography>
        </Box>

        {/* Connection / monitoring status. Each chip carries an
            aria-label so SR users + colour-blind users get the state
            without relying on the green/red dot. The "Monitoring" pulse
            animation is wrapped in prefers-reduced-motion so vestibular
            users get a steady dot instead. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Chip
            icon={<DotIcon sx={{ fontSize: '12px !important' }} aria-hidden />}
            label={riskData.isConnected ? 'Connected' : 'Disconnected'}
            size="small"
            aria-label={
              riskData.isConnected
                ? 'Cortex socket connected'
                : 'Cortex socket disconnected'
            }
            sx={{
              height: 24,
              fontWeight: 600,
              bgcolor: riskData.isConnected ? 'rgba(76, 217, 100, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: riskData.isConnected ? BRAND : '#EF4444',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          {isMonitoring && (
            <Chip
              icon={<DotIcon sx={{ fontSize: '12px !important' }} aria-hidden />}
              label="Monitoring"
              size="small"
              aria-label="Monitoring active"
              sx={{
                height: 24,
                fontWeight: 600,
                bgcolor: 'rgba(76, 217, 100, 0.15)',
                color: BRAND,
                '& .MuiChip-icon': {
                  color: BRAND,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
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

        {/* End Interview — explicit, confirmed finalize. Distinct from the
            back-arrow exit so ending is always a deliberate, acknowledged
            action. */}
        <Button
          onClick={() => setEndDialogOpen(true)}
          variant="contained"
          color="error"
          size="small"
          startIcon={<EndIcon />}
          sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 600 }}
        >
          End Interview
        </Button>
      </Box>

      {/* End-interview confirmation. Finalizing a live session is
          irreversible (it can only be resumed inside the 60s reload grace),
          so we always ask first. */}
      <Dialog
        open={endDialogOpen}
        onClose={() => setEndDialogOpen(false)}
        aria-labelledby="end-interview-title"
        aria-describedby="end-interview-desc"
      >
        <DialogTitle id="end-interview-title">End this interview?</DialogTitle>
        <DialogContent>
          <DialogContentText id="end-interview-desc">
            Are you sure you want to end the interview? This stops live
            monitoring and finalizes the session — it can&apos;t be resumed
            afterwards. All captured activity is preserved for post-interview
            analysis.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEndDialogOpen(false)}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            Keep monitoring
          </Button>
          <Button
            onClick={handleEndInterview}
            variant="contained"
            color="error"
            startIcon={<EndIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            End interview
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full monitoring UI */}
      <>
          {/* Pre-join checklists */}
          {!riskData.candidateStatus?.joined
            ? <CandidateSetupCard status={riskData.candidateStatus} />
            : !riskData.candidateStatus?.screen_recording
              ? <CandidateSetupCard status={riskData.candidateStatus} revoked />
              : null
          }

          {/* Interviewer setup gate removed. Their voice now reaches Cortex
              via the candidate-side SystemAudioCapture (SCStream of system
              audio output), so they don't need to install Trueyy Helper or
              grant mic permission on their own machine. AnalyticsPanel
              renders unconditionally. The useHelper hook + helper.join
              call above stay in case a helper IS installed (it'll bind to
              the session and add a redundant interviewer-side mic stream
              that Cortex's transcriptFusion dedup will merge). */}
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
      </>
    </Box>
  );
}
