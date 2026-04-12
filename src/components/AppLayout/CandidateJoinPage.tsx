/**
 * CandidateJoinPage — 3-step setup flow for extension-type interviews
 *
 * Route: /interviews/:id/join
 *
 * Steps:
 *   1. Install Extension — detect via ping, show download link if missing
 *   2. Enable Monitoring — Sentinel handshake + Screen Recording permission
 *   3. Join Meeting — opens meeting tab once permission is granted
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  ArrowBack as ArrowBackIcon,
  Extension as ExtensionIcon,
  Shield as ShieldIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { InterviewService } from '../../services/interview.service';
import {
  pingExtension,
  sendJoinInterviewToExtension,
  sendAuthToExtension,
  enableMonitoring,
  getMonitoringState,
  openMeeting,
  resetMonitoring,
} from '../../services/extensionBridge';
import { useAuth } from '../../contexts/AuthContext';
import { USER_ROLES } from '../../config/constants';
import type { InterviewSession } from '../../types/interview.types';
import { TOKENS } from '../../theme';
import FalconDownloadCard from '../common/FalconDownloadCard';

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

interface StepState {
  extension: 'pending' | 'checking' | 'done' | 'missing';
  monitoring: 'pending' | 'connecting' | 'done' | 'permission-needed';
  meeting: 'pending' | 'opening' | 'done';
}

export default function CandidateJoinPage() {
  const { id: interviewId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState>({
    extension: 'checking',
    monitoring: 'pending',
    meeting: 'pending',
  });
  const [permError, setPermError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Role gate: only candidates can access this page ─────────────────
  useEffect(() => {
    if (userRole === USER_ROLES.INTERVIEWER) {
      navigate('/', { replace: true });
    }
  }, [userRole, navigate]);

  // ── Load interview + validate candidate is a participant ───────────
  useEffect(() => {
    if (!interviewId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await InterviewService.getById(interviewId);
        if (cancelled) return;
        if (resp.success && resp.data) {
          // Verify this candidate is actually a participant
          const isParticipant = resp.data.interview_session_participants?.some(
            (p) => p.candidate_id === user.id
          );
          if (!isParticipant) {
            navigate('/', { replace: true });
            return;
          }
          setInterview(resp.data);
        } else {
          setError(resp.message || 'Interview not found');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load interview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, user?.id]);

  // ── Step 1: Detect extension ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      setSteps((s) => ({ ...s, extension: 'checking' }));
      const available = await pingExtension();
      setSteps((s) => ({ ...s, extension: available ? 'done' : 'missing' }));
    })();
  }, []);

  // ── Continuous poll: pick up state changes from background/overlay ──
  // Runs while step 2 is not done. When the overlay triggers enable-
  // monitoring and Sentinel reports ready, this poll catches it and
  // flips step 2 → done, step 3 → active — no extra click needed.
  useEffect(() => {
    if (steps.extension !== 'done' || steps.monitoring === 'done') return;

    const interval = setInterval(async () => {
      try {
        const state = await getMonitoringState();
        if (state.ready) {
          setSteps((s) => {
            if (s.monitoring === 'done') return s;
            return { ...s, monitoring: 'done', meeting: 'pending' };
          });
          setPermError(null);
        }
      } catch (_) { /* keep polling */ }
    }, 1500);

    return () => clearInterval(interval);
  }, [steps.extension, steps.monitoring]);

  // ── Stop explicit polling on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Step 2: Enable Monitoring ──────────────────────────────────────
  const handleEnableMonitoring = useCallback(async () => {
    if (!interview || !interviewId) return;
    setSteps((s) => ({ ...s, monitoring: 'connecting' }));
    setPermError(null);

    try {
      // Send auth tokens to the extension so it can authenticate with
      // Cortex. This replaces the old /authorize-extension page — since
      // the candidate is already logged into Skyview, we just hand the
      // tokens over automatically. No separate authorize step needed.
      if (user) {
        await sendAuthToExtension(user);
      }

      // Send join-interview to store session in extension
      const joinUrl = interview.provider_metadata?.join_url ?? null;
      await sendJoinInterviewToExtension({
        sessionId: interviewId,
        joinUrl: joinUrl as string | null,
        interview,
      });

      // Then enable monitoring (spawns Sentinel)
      const resp = await enableMonitoring();
      if (!resp.ok) {
        if (resp.error === 'native-host-unavailable') {
          setPermError('Trueyy Helper is not installed. Run install.sh first.');
        } else {
          setPermError(resp.error || 'Failed to connect');
        }
        setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
        return;
      }

      // Poll for Sentinel ready state
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const state = await getMonitoringState();
          if (state.ready) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setSteps((s) => ({ ...s, monitoring: 'done', meeting: 'pending' }));
          } else if (state.permission) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
          }
        } catch (_) { /* keep polling */ }
      }, 1000);
    } catch (err: any) {
      setPermError(err?.message || 'Failed to connect to extension');
      setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
    }
  }, [interview, interviewId]);

  // ── Step 2b: Retry after permission grant ──────────────────────────
  const handleRetry = useCallback(async () => {
    setSteps((s) => ({ ...s, monitoring: 'connecting' }));
    setPermError(null);
    try {
      const resp = await resetMonitoring();
      if (!resp.ok) {
        setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
        setPermError(resp.error || 'Failed to restart');
        return;
      }
      // Poll for result
      setTimeout(async () => {
        try {
          const state = await getMonitoringState();
          if (state.ready) {
            setSteps((s) => ({ ...s, monitoring: 'done', meeting: 'pending' }));
          } else {
            setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
            setPermError('Still not granted. Toggle Trueyy Helper ON in Screen Recording, then quit Chrome (⌘Q) and reopen.');
          }
        } catch (_) {
          setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
        }
      }, 2000);
    } catch (err: any) {
      setSteps((s) => ({ ...s, monitoring: 'permission-needed' }));
      setPermError(err?.message || 'Failed');
    }
  }, []);

  // ── Step 3: Open Meeting ───────────────────────────────────────────
  const handleOpenMeeting = useCallback(async () => {
    setSteps((s) => ({ ...s, meeting: 'opening' }));
    try {
      const resp = await openMeeting();
      if (resp.ok) {
        setSteps((s) => ({ ...s, meeting: 'done' }));
      } else {
        setSteps((s) => ({ ...s, meeting: 'pending' }));
      }
    } catch (_) {
      setSteps((s) => ({ ...s, meeting: 'pending' }));
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#F9FAFB' }}>
      {/* Header — same as MonitoringView */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 1.5,
          borderBottom: `1px solid ${LIGHT_BORDER}`,
          bgcolor: LIGHT_BG,
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={() => navigate('/interviews')}
          size="small"
          sx={{ color: '#6B7280', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', color: '#1F2937' } }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937' }}>
            {interview.title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
            Setup your monitoring before joining
          </Typography>
        </Box>
      </Box>

      {interview.interview_type === 'application' ? (
        <FalconDownloadCard />
      ) : (
      /* Steps — upper-third, centered card */
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: { xs: 3, md: 6 }, px: { xs: 2, md: 3 }, pb: 3 }}>
        <Box
          sx={{
            width: 460,
            maxWidth: '100%',
            bgcolor: LIGHT_BG,
            borderRadius: '12px',
            border: `1px solid ${LIGHT_BORDER}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          /* ── Extension type: Chrome extension flow ── */
          <>
          {/* Step rows — each is a self-contained row with its own bg */}
          <StepRow
            number={1}
            icon={<ExtensionIcon sx={{ fontSize: 18 }} />}
            title="Install Extension"
            done={steps.extension === 'done'}
            active={steps.extension !== 'done'}
            first
          >
            {steps.extension === 'checking' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} sx={{ color: BRAND }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Detecting...</Typography>
              </Box>
            )}
            {steps.extension === 'done' && (
              <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
                Trueyy Candidate Monitor detected
              </Typography>
            )}
            {steps.extension === 'missing' && (
              <>
                <Typography sx={{ fontSize: '0.75rem', color: '#DC2626', mb: 0.75 }}>
                  Extension not found
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => window.location.reload()}
                  sx={{ fontSize: '0.7rem', textTransform: 'none', p: 0, minWidth: 0, color: BRAND, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                >
                  Reload page
                </Button>
              </>
            )}
          </StepRow>

          <StepRow
            number={2}
            icon={<ShieldIcon sx={{ fontSize: 18 }} />}
            title="Enable Monitoring"
            done={steps.monitoring === 'done'}
            active={steps.extension === 'done' && steps.monitoring !== 'done'}
          >
            {steps.monitoring === 'pending' && steps.extension === 'done' && (
              <>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mb: 1 }}>
                  Monitors apps, keyboard activity, and screen captures
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleEnableMonitoring}
                  sx={{
                    bgcolor: BRAND,
                    color: '#fff',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    py: 0.5,
                    px: 2,
                    borderRadius: '6px',
                    '&:hover': { bgcolor: '#3CB853' },
                    boxShadow: 'none',
                  }}
                >
                  Enable Monitoring
                </Button>
              </>
            )}
            {steps.monitoring === 'connecting' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} sx={{ color: BRAND }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Connecting...</Typography>
              </Box>
            )}
            {steps.monitoring === 'done' && (
              <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
                Screen Recording granted
              </Typography>
            )}
            {steps.monitoring === 'permission-needed' && (
              <>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mb: 0.5 }}>
                  Enable <strong>Screen Recording</strong> for <strong>Trueyy Helper</strong>
                </Typography>
                {permError && (
                  <Typography sx={{ fontSize: '0.688rem', color: '#DC2626', mb: 0.5 }}>
                    {permError}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      window.open('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
                    }}
                    sx={{
                      bgcolor: BRAND,
                      color: '#fff',
                      textTransform: 'none',
                      fontSize: '0.688rem',
                      py: 0.25,
                      px: 1.5,
                      borderRadius: '6px',
                      '&:hover': { bgcolor: '#3CB853' },
                      boxShadow: 'none',
                    }}
                  >
                    Open Settings
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleRetry}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.688rem',
                      py: 0.25,
                      px: 1.5,
                      borderRadius: '6px',
                      borderColor: LIGHT_BORDER,
                      color: '#6B7280',
                      '&:hover': { borderColor: '#9CA3AF', bgcolor: '#F9FAFB' },
                    }}
                  >
                    Try Again
                  </Button>
                </Box>
              </>
            )}
          </StepRow>

          <StepRow
            number={3}
            icon={<VideoCallIcon sx={{ fontSize: 18 }} />}
            title="Join Meeting"
            done={steps.meeting === 'done'}
            active={steps.monitoring === 'done' && steps.meeting !== 'done'}
            last
          >
            {steps.monitoring === 'done' && steps.meeting === 'pending' && (
              <Button
                variant="contained"
                size="small"
                onClick={handleOpenMeeting}
                sx={{
                  bgcolor: BRAND,
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  py: 0.5,
                  px: 2,
                  borderRadius: '6px',
                  '&:hover': { bgcolor: '#3CB853' },
                  boxShadow: 'none',
                }}
              >
                Open Meeting
              </Button>
            )}
            {steps.meeting === 'opening' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} sx={{ color: BRAND }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Opening...</Typography>
              </Box>
            )}
            {steps.meeting === 'done' && (
              <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
                Meeting opened — you can close this tab
              </Typography>
            )}
          </StepRow>
          </>
        </Box>
      </Box>
      )}
    </Box>
  );
}

// ── Step row subcomponent ─────────────────────────────────────────────
//
// Each step is a distinct row inside the card. Done rows get a green
// tinted background; the active row is white with full opacity; future
// rows are dimmed. Matching the CandidateSetupCard row pattern.

function StepRow({
  number,
  icon,
  title,
  done,
  active,
  first,
  last,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  done: boolean;
  active: boolean;
  first?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const ROW_BG_DONE = 'rgba(76, 217, 100, 0.06)';
  const ROW_BG_ACTIVE = '#FFFFFF';
  const ROW_BG_PENDING = '#FAFAFA';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2.5,
        py: 2,
        bgcolor: done ? ROW_BG_DONE : active ? ROW_BG_ACTIVE : ROW_BG_PENDING,
        borderBottom: last ? 'none' : `1px solid ${LIGHT_BORDER}`,
        borderRadius: first && last ? '12px' : first ? '12px 12px 0 0' : last ? '0 0 12px 12px' : 0,
        opacity: !active && !done ? 0.45 : 1,
        transition: 'background 0.2s, opacity 0.2s',
      }}
    >
      {/* Step number circle */}
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: done ? BRAND : active ? '#1F2937' : '#D1D5DB',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {done ? <CheckIcon sx={{ fontSize: 16 }} /> : number}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: children ? 0.5 : 0 }}>
          <Box sx={{ color: done ? BRAND : active ? '#1F2937' : '#9CA3AF', display: 'flex' }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: done ? '#065F46' : '#1F2937' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </Box>
    </Box>
  );
}
