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
import { useInterviewerExtension } from '../../hooks/useInterviewerExtension';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { USER_ROLES } from '../../config/constants';
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
  const [isMonitoring, setIsMonitoring] = useState(false);

  const riskData = useRiskSocket(interviewId ?? null);
  const interviewerExt = useInterviewerExtension();

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

  // Send auth + session to the interviewer extension once interview loads
  // and the extension is detected. Mirrors the Skyview → candidate
  // extension handshake done by extensionBridge.ts, but for the
  // interviewer's mic-only extension.
  useEffect(() => {
    if (!interviewId || !interviewerExt.installed || !user) return;
    // Skyview stores the JWT under STORAGE_KEYS.ACCESS_TOKEN = "auth_access_token".
    const token = localStorage.getItem('auth_access_token') || '';
    if (token && user.id) {
      interviewerExt.sendAuth(token, { id: user.id, email: user.email || '' });
      interviewerExt.joinSession(interviewId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, interviewerExt.installed, user]);

  const handleStartMonitoring = () => {
    riskData.emitStartMonitoring();
    // Also tell the interviewer extension to start mic capture
    interviewerExt.startMic();
    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    riskData.emitStopMonitoring();
    interviewerExt.stopMic();
    setIsMonitoring(false);
  };

  const handleExit = () => {
    if (isMonitoring) {
      riskData.emitStopMonitoring();
    }
    navigate('/interviews');
  };

  // Permission check: only interviewers should reach this view
  useEffect(() => {
    if (userRole !== USER_ROLES.INTERVIEWER) {
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
            sx={{
              fontSize: { xs: '0.85rem', md: '1rem' },
              fontWeight: 700,
              color: '#1F2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {interview.title}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', display: { xs: 'none', sm: 'block' } }}>
            {interviewerExt.installed && interviewerExt.micGranted
              ? `${candidateName} · ${interview.interview_type === 'extension' ? 'Chrome Extension' : 'Falcon App'}`
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
              fontSize: '0.7rem',
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
                fontSize: '0.7rem',
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

          {/* Interviewer mic setup — 2-step stepper mirroring the
              CandidateJoinPage design. Hidden once both steps are done;
              Risk Analytics takes over and surfaces the "Open meeting
              link" chip in the header for joining the meeting. */}
          {!(interviewerExt.installed && interviewerExt.micGranted) && (
            <InterviewerSetupCard
              installed={interviewerExt.installed}
              micGranted={interviewerExt.micGranted}
              checking={interviewerExt.checking}
              onEnableMic={interviewerExt.enableMic}
              onRetryMic={interviewerExt.retryMic}
            />
          )}

          {/* AnalyticsPanel — shown once both stepper steps are done. */}
          {interviewerExt.installed && interviewerExt.micGranted && (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <AnalyticsPanel
                interview={interview}
                riskData={riskData}
                isMonitoring={isMonitoring}
                onStartMonitoring={handleStartMonitoring}
                onStopMonitoring={handleStopMonitoring}
                onClose={handleExit}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
