/**
 * CandidateJoinPage — 3-step setup flow for extension-type interviews.
 *
 * Route: /interviews/:id/join
 *
 * Architecture (post-helper migration):
 *   The Chrome extension has been removed. Skyview now talks directly
 *   to the Trueyy Helper daemon running on 127.0.0.1:48123 via
 *   helperBridge + useHelper. If the helper isn't installed we show the
 *   HelperDownloadCard; otherwise we POST /session/join once the
 *   interview is loaded and let the helper drive the rest.
 *
 * Steps:
 *   1. Trueyy Helper installed (detected via local /health)
 *   2. Permissions granted (screen recording + microphone)
 *   3. Join Meeting — opens the meeting URL in a new tab
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import { CardTitle, Secondary, Caption } from '../layout/Typography';
import {
  CheckCircle as CheckIcon,
  ArrowBack as ArrowBackIcon,
  Extension as ExtensionIcon,
  Shield as ShieldIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { InterviewService } from '../../services/interview.service';
import { useAuth } from '../../contexts/AuthContext';
import { useHelper } from '../../hooks/useHelper';
import { openSettingsPane, detectHelperPlatform } from '../../services/helperBridge';
import { USER_ROLES, STORAGE_KEYS, isStaffRole } from '../../config/constants';
import { ENV } from '../../config/env';
import type { InterviewSession } from '../../types/interview.types';
import { TOKENS } from '../../theme';
import FalconDownloadCard from '../common/FalconDownloadCard';
import HelperDownloadCard from '../Monitoring/HelperDownloadCard';
import StepRow from '../common/StepRow';

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

export default function CandidateJoinPage() {
  const { id: interviewId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingOpened, setMeetingOpened] = useState(false);

  const helper = useHelper(2000);
  // Deliberately NO teardown on the candidate side — the candidate
  // usually clicks "Open meeting" and leaves the Skyview tab while the
  // interview continues in Zoom. Session lifetime ends when the
  // interviewer leaves their MonitoringView (handled server-side via
  // socket-disconnect → remote-end-session).

  // ── Role gate: only candidates can access this page ─────────────────
  useEffect(() => {
    if (isStaffRole(userRole)) {
      navigate('/', { replace: true });
    }
  }, [userRole, navigate]);

  // ── Load interview ────────────────────────────────────────────────
  // Participant membership is enforced server-side: getByIdController
  // returns 404 to any candidate who isn't on this session. So if the
  // GET succeeds, we already know this candidate belongs here — no
  // client-side re-check needed. We still need interview_session_participants
  // in the payload to grab the candidate's own participant_id for
  // helper.join() (see effect below); that field is preserved by
  // projectForCandidate with evaluation internals stripped.
  useEffect(() => {
    if (!interviewId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await InterviewService.getById(interviewId);
        if (cancelled) return;
        if (resp.success && resp.data) {
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
  }, [interviewId, user?.id, navigate]);

  // ── Once helper is reachable AND interview is loaded, bind the ────
  // session: POST /session/join. Helper connects to Cortex, runs
  // preflight, and starts reporting status via /status.
  useEffect(() => {
    if (!helper.installed) return;
    if (!interview || !interviewId || !user?.id) return;
    // Skip if already bound to this session
    if (helper.status?.session_id === interviewId) return;

    const candidatePartId = interview.interview_session_participants?.find(
      (p) => p.candidate_id === user.id
    )?.id;
    if (!candidatePartId) return;

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
    if (!token) return;

    (async () => {
      const r = await helper.join({
        session_id: interviewId,
        participant_id: candidatePartId,
        role: 'candidate',
        token,
        cortex_url: ENV.AUTH_API_URL,
      });
      if (!r.ok) {
        setError(r.error || 'Failed to start session on helper');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helper.installed, interview, interviewId, user?.id, helper.status?.session_id]);

  // ── Step 3: Open Meeting ──────────────────────────────────────────
  const handleOpenMeeting = useCallback(() => {
    const url = interview?.provider_metadata?.join_url;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setMeetingOpened(true);
  }, [interview]);

  // ── Permission request buttons — route through the helper daemon ──
  // Chrome/Safari block x-apple.systempreferences: URLs via window.open,
  // so we POST to the helper which shells out to `open` (that works).
  const openScreenRecordingSettings = () => openSettingsPane('screen_recording');
  const openMicSettings = () => openSettingsPane('microphone');

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
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

  // Derived UI state from helper status + local flags
  const extensionState = helper.checking
    ? 'checking'
    : helper.installed ? 'done' : 'missing';
  const screenOk = !!helper.status?.screen_recording_ok || interview.interview_type !== 'extension';
  const micOk = !!helper.status?.microphone_ok;
  const monitoringState = !helper.installed
    ? 'pending'
    : screenOk && micOk
      ? 'done'
      : 'permission-needed';
  const meetingState = meetingOpened ? 'done' : monitoringState === 'done' ? 'pending' : 'pending';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F9FAFB' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: { xs: 2, md: 3 }, py: 1.5,
        borderBottom: `1px solid ${LIGHT_BORDER}`, bgcolor: LIGHT_BG,
      }}>
        <IconButton onClick={() => navigate('/')} size="small" sx={{ color: '#6B7280' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CardTitle sx={{ fontWeight: 700, color: TOKENS.textPrimary }}>
            {interview.title}
          </CardTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Setup your monitoring before joining
          </Secondary>
        </Box>
      </Box>

      {interview.interview_type === 'application' ? (
        <FalconDownloadCard />
      ) : !helper.installed && !helper.checking ? (
        <HelperDownloadCard checking={helper.checking} onRetry={() => helper.refresh()} />
      ) : (
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          pt: { xs: 3, md: 6 }, px: { xs: 2, md: 3 }, pb: 3,
        }}>
          <Box sx={{
            width: 460, maxWidth: '100%', bgcolor: LIGHT_BG,
            borderRadius: '12px', border: `1px solid ${LIGHT_BORDER}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          }}>
            {/* Step 1 — Helper installed */}
            <StepRow number={1} icon={<ExtensionIcon sx={{ fontSize: 18 }} />} title="Install Trueyy Helper"
              done={extensionState === 'done'} active={extensionState !== 'done'} first>
              {extensionState === 'checking' && <Status busy text="Detecting..." />}
              {extensionState === 'done' && <Status ok text="Trueyy Helper detected" />}
              {extensionState === 'missing' && <Status err text="Helper not running" />}
            </StepRow>

            {/* Step 2 — Permissions */}
            <StepRow number={2} icon={<ShieldIcon sx={{ fontSize: 18 }} />} title="Grant Permissions"
              done={monitoringState === 'done'}
              active={extensionState === 'done' && monitoringState !== 'done'}>
              {monitoringState === 'pending' && helper.installed && (
                <Status busy text="Connecting to helper..." />
              )}
              {monitoringState === 'done' && (
                <Status ok text="Screen Recording & Microphone granted" />
              )}
              {monitoringState === 'permission-needed' && (
                <>
                  <PermissionRow title="Screen Recording"
                    desc="Required for app / window monitoring"
                    done={screenOk} onEnable={openScreenRecordingSettings} />
                  <PermissionRow title="Microphone"
                    desc="Required for live transcription"
                    done={micOk} onEnable={openMicSettings} />
                  <Caption sx={{ display: 'block', color: TOKENS.textSecondary, mt: 1 }}>
                    {detectHelperPlatform() === 'windows'
                      ? <>Enable <strong>Microphone access</strong> (and <strong>Let desktop apps access your microphone</strong>) in Windows Settings, then return here. This page updates automatically.</>
                      : <>Toggle <strong>Trueyy Helper</strong> ON in each pane, then return here. This page updates automatically.</>}
                  </Caption>
                </>
              )}
            </StepRow>

            {/* Step 3 — Join Meeting */}
            <StepRow number={3} icon={<VideoCallIcon sx={{ fontSize: 18 }} />} title="Join Meeting"
              done={meetingState === 'done'}
              active={monitoringState === 'done' && meetingState !== 'done'} last>
              {monitoringState === 'done' && meetingState === 'pending' && (
                <ActionButton
                  onClick={handleOpenMeeting}
                  disabled={!interview.provider_metadata?.join_url}
                >
                  Open Meeting
                </ActionButton>
              )}
              {meetingState === 'done' && <Status ok text="Meeting opened — keep this tab open" />}
            </StepRow>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Small helper components ─────────────────────────────────────────

function Status({ busy, ok, err, text }: { busy?: boolean; ok?: boolean; err?: boolean; text: string }) {
  const color = ok ? TOKENS.success : err ? TOKENS.error : TOKENS.textSecondary;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {busy && <CircularProgress size={12} sx={{ color: BRAND }} />}
      <Secondary sx={{ color }}>{text}</Secondary>
    </Box>
  );
}


function PermissionRow({ title, desc, done, onEnable }: {
  title: string; desc: string; done: boolean; onEnable: () => void;
}) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 1, mt: 0.75,
      borderRadius: '8px',
      bgcolor: done ? 'rgba(76, 217, 100, 0.06)' : '#FAFAFA',
      border: `1px solid ${done ? 'rgba(76, 217, 100, 0.3)' : LIGHT_BORDER}`,
    }}>
      <Box sx={{
        width: 22, height: 22, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: done ? BRAND : '#E5E7EB', color: done ? '#fff' : '#6B7280',
        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
      }}>
        {done ? <CheckIcon sx={{ fontSize: 14 }} /> : '⏳'}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Secondary sx={{ fontWeight: 600, color: done ? '#065F46' : TOKENS.textPrimary }}>
          {title}
        </Secondary>
        <Caption sx={{ display: 'block', color: TOKENS.textSecondary }}>
          {done ? 'Granted to Trueyy Helper' : desc}
        </Caption>
      </Box>
      {!done && (
        <ActionButton onClick={onEnable} sx={{ px: 1.25, py: 0.25, fontSize: '0.688rem', flexShrink: 0 }}>
          Enable
        </ActionButton>
      )}
    </Box>
  );
}
