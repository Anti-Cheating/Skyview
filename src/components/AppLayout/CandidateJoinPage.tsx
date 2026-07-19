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
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Shield as ShieldIcon,
  VideoCall as VideoCallIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { InterviewService } from '../../services/interview.service';
import { SessionJoinService } from '../../services/sessionJoin.service';
import { useAuth } from '../../contexts/AuthContext';
import { useHelper } from '../../hooks/useHelper';
import {
  openSettingsPane,
  requestHelperPermission,
  detectHelperPlatform,
  notifyMeetingJoined,
} from '../../services/helperBridge';
import { USER_ROLES, STORAGE_KEYS, isStaffRole } from '../../config/constants';
import { ENV } from '../../config/env';
import type { InterviewSession } from '../../types/interview.types';
import { TOKENS } from '../../theme';
import HelperDownloadCard from '../Monitoring/HelperDownloadCard';
import ConsentScreen from '../Consent/ConsentScreen';
import ConsentOutcome from '../Consent/ConsentOutcome';
import JoinStepper, { type JoinStep } from '../Consent/JoinStepper';
import { ConsentService, type ConsentText } from '../../services/consent.service';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

export default function CandidateJoinPage() {
  const { id: interviewId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshAuth } = useAuth();

  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingOpened, setMeetingOpened] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  // ── Magic-link exchange ──────────────────────────────────────────
  // Public route: no PrivateRoute gate. If the URL carries ?t=<token>
  // and there's no authenticated user yet, trade it for a real session
  // before anything else runs. Runs once per mount.
  useEffect(() => {
    if (user) return; // already signed in (e.g. re-visit on the same tab)
    const token = new URLSearchParams(location.search).get('t');
    if (!token || !interviewId) return;
    let cancelled = false;
    setExchanging(true);
    (async () => {
      const result = await SessionJoinService.exchangeJoinToken(interviewId, token);
      if (cancelled) return;
      if (!result.ok) {
        setExchangeError(result.error);
        setExchanging(false);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, result.data.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));
      await refreshAuth();
      setExchanging(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // Fallback: no token in the URL and no authenticated user — nothing
  // this page can do, send them to login preserving returnTo (mirrors
  // PrivateRoute's own redirect behaviour for a page that's now public).
  useEffect(() => {
    if (user || exchanging) return;
    const token = new URLSearchParams(location.search).get('t');
    if (token) return; // magic-link effect above is handling this
    const here = location.pathname + location.search;
    navigate(`/login?returnTo=${encodeURIComponent(here)}`, { replace: true });
  }, [user, exchanging, location, navigate]);

  // ── Consent (GDPR Art. 7) — blocks ALL helper interaction until given.
  const [consent, setConsent] = useState<'loading' | 'needed' | 'given' | 'declined' | 'revoked'>('loading');
  const [consentText, setConsentText] = useState<ConsentText | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

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

  // ── Load consent state once the interview is known ────────────────
  useEffect(() => {
    if (!interview || !interviewId) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await ConsentService.text(interviewId);
        if (cancelled) return;
        if (resp.success && resp.data) {
          setConsentText(resp.data);
          setConsent(resp.data.consented ? 'given' : 'needed');
        } else {
          setError(resp.message || 'Failed to load consent details');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load consent details');
      }
    })();
    return () => { cancelled = true; };
  }, [interview, interviewId]);

  const handleAgree = useCallback(async () => {
    if (!interviewId || !consentText) return;
    setConsentBusy(true);
    try {
      const resp = await ConsentService.grant(interviewId, consentText.version);
      if (resp.success) {
        setConsent('given');
      } else if ((resp as { error?: string }).error === 'stale_text') {
        // Legal shipped new wording between page load and Agree — re-show.
        const fresh = await ConsentService.text(interviewId);
        if (fresh.success && fresh.data) setConsentText(fresh.data);
      } else {
        setError(resp.message || 'Failed to record consent');
      }
    } finally {
      setConsentBusy(false);
    }
  }, [interviewId, consentText]);

  const handleDecline = useCallback(async () => {
    if (!interviewId) return;
    setConsentBusy(true);
    try {
      await ConsentService.decline(interviewId);
      setConsent('declined');
    } finally {
      setConsentBusy(false);
    }
  }, [interviewId]);

  const handleWithdraw = useCallback(async () => {
    if (!interviewId) return;
    setWithdrawOpen(false);
    setConsentBusy(true);
    try {
      await ConsentService.revoke(interviewId);
      setConsent('revoked');
    } finally {
      setConsentBusy(false);
    }
  }, [interviewId]);

  // ── Once consent is given, helper is reachable AND interview is ────
  // loaded, bind the session: POST /session/join. Helper connects to
  // Cortex, runs preflight, and starts reporting status via /status.
  // The consent gate here is belt-and-braces — Cortex's sessionGuard
  // refuses capture writes without an open consent row regardless.
  useEffect(() => {
    if (consent !== 'given') return;
    if (!helper.installed) return;
    if (!interview || !interviewId || !user?.id) return;
    // Never bind the helper to a terminal session — it can't be joined.
    if (['CANCELLED', 'COMPLETED', 'ENDED'].includes(interview.status)) return;
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
  }, [consent, helper.installed, interview, interviewId, user?.id, helper.status?.session_id]);

  // ── Step 3: Open Meeting ──────────────────────────────────────────
  const handleOpenMeeting = useCallback(() => {
    const url = interview?.provider_metadata?.join_url;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setMeetingOpened(true);
    // Tell the helper the candidate just joined. Helper emits
    // candidate-status.joined=true on its live Cortex socket so the
    // interviewer's "Joined" pill flips green. Fire-and-forget — the
    // candidate is about to navigate away to the meeting tab anyway,
    // and if this drops we'll still update on the next status push.
    void notifyMeetingJoined();
  }, [interview]);

  // ── Permission request buttons — route through the helper daemon ──
  // Browsers can't open x-apple.systempreferences: URLs, so we POST to
  // the helper. The /permissions/request endpoint:
  //   1. Calls the matching macOS API (CGRequestScreenCaptureAccess /
  //      AVCaptureDevice.requestAccess) — this is what registers
  //      Trueyy Helper with TCC so it appears in Privacy & Security.
  //      Without this step the System Settings list stays empty.
  //   2. Opens System Settings at the matching pane.
  // useHelper polls /permissions every few seconds so as soon as the
  // candidate flips the toggle on, screenOk / micOk auto-flip and
  // the row turns green — no need to come back and click Enable again.
  //
  // Falls back to plain openSettingsPane on non-mac platforms (Linux
  // doesn't have these APIs; the helper just opens Settings).
  const openScreenRecordingSettings = async () => {
    const ok = await requestHelperPermission('screen_recording');
    if (!ok) await openSettingsPane('screen_recording');
    helper.refresh();
  };
  const openMicSettings = async () => {
    const ok = await requestHelperPermission('microphone');
    if (!ok) await openSettingsPane('microphone');
    helper.refresh();
  };
  const openKeyboardSettings = async () => {
    const ok = await requestHelperPermission('accessibility');
    if (!ok) await openSettingsPane('accessibility');
    helper.refresh();
  };

  // ── Render ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box
        // role="status" + aria-live tells AT users that we're loading,
        // and aria-label gives the spinner an accessible name. Was a
        // silent spinner: SR users heard nothing while the page loaded.
        role="status"
        aria-live="polite"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        <CircularProgress sx={{ color: BRAND }} aria-label="Loading interview" />
      </Box>
    );
  }
  if (exchanging) {
    return (
      <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: BRAND }} aria-label="Signing you in" />
      </Box>
    );
  }
  if (exchangeError) {
    return (
      <Box sx={{ p: 3, maxWidth: 520, mx: 'auto', mt: 8 }}>
        <Alert severity="error">{exchangeError} Try clicking the link from your invite email again, or contact your interviewer.</Alert>
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

  // Guard the direct-from-email link: a cancelled / completed / ended interview
  // can't be joined, so show a clear message instead of the join flow.
  if (['CANCELLED', 'COMPLETED', 'ENDED'].includes(interview.status)) {
    const label = interview.status === 'CANCELLED' ? 'cancelled' : interview.status === 'COMPLETED' ? 'completed' : 'ended';
    return (
      <Box sx={{ p: 3, maxWidth: 520, mx: 'auto', mt: 8 }}>
        <Alert severity="info">
          This interview has been {label} and can no longer be joined. Please contact your interviewer if you believe this is a mistake.
        </Alert>
      </Box>
    );
  }

  if (consent === 'loading') {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: BRAND }} />
      </Box>
    );
  }

  // ── Derived UI state from helper status + local flags ──────────────
  const screenOk = !!helper.status?.screen_recording_ok;
  const micOk = !!helper.status?.microphone_ok;
  const keyboardOk = !!helper.status?.keyboard_ok;
  const allPermissions = screenOk && micOk && keyboardOk;
  const monitoringState = !helper.installed
    ? 'pending'
    : allPermissions ? 'done' : 'permission-needed';

  // Which of the 4 steps is active. Install + permissions self-complete
  // from a returning candidate's machine, so re-consent (and repeat
  // interviews) land straight on the last incomplete step.
  const currentStep: JoinStep =
    consent !== 'given' ? 'consent'
    : !helper.installed ? 'install'
    : !allPermissions ? 'permissions'
    : 'join';

  const declinedOrRevoked = consent === 'declined' || consent === 'revoked';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F9FAFB' }}>
      {/* Header — context bar: back arrow, company logo, interview title. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        px: { xs: 2, md: 3 }, py: 1.5,
        borderBottom: `1px solid ${LIGHT_BORDER}`, bgcolor: LIGHT_BG,
      }}>
        <IconButton onClick={() => navigate('/')} size="small" aria-label="Back to dashboard" sx={{ color: '#6B7280' }}>
          <ArrowBackIcon />
        </IconButton>
        {interview.company?.logo_url && (
          <Box sx={{
            width: 40, height: 40, borderRadius: '8px', border: `1px solid ${LIGHT_BORDER}`,
            bgcolor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={interview.company.logo_url} alt={interview.company.name}
              style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} draggable={false} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CardTitle component="h1" sx={{ m: 0, fontWeight: 700, color: TOKENS.textPrimary }}>
            {interview.title}
          </CardTitle>
          {interview.company?.name && (
            <Secondary sx={{ color: TOKENS.textSecondary }}>Hosted by {interview.company.name}</Secondary>
          )}
        </Box>
      </Box>

      {/* Declined / withdrawn dead-ends — no stepper, just the recovery card. */}
      {declinedOrRevoked ? (
        <Box sx={{ flex: 1 }}>
          {consent === 'declined' ? (
            <ConsentOutcome
              title="Monitoring declined"
              message="You've declined monitoring consent. Your interviewer has been notified — this interview can't proceed with integrity monitoring until you agree."
              actionLabel="I changed my mind — review again"
              onAction={() => setConsent('needed')}
            />
          ) : (
            <ConsentOutcome
              title="Monitoring stopped"
              message="You withdrew your consent. Your interviewer has been notified and no further data is being recorded."
              actionLabel="Re-enable monitoring"
              onAction={async () => {
                const fresh = await ConsentService.text(interviewId!);
                if (fresh.success && fresh.data) setConsentText(fresh.data);
                setConsent('needed');
              }}
            />
          )}
        </Box>
      ) : (
        <>
          <JoinStepper current={currentStep} />

          {/* Step body — centered card per current step. */}
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            pt: { xs: 3, md: 5 }, px: { xs: 2, md: 3 }, pb: 3,
          }}>
            {currentStep === 'consent' && consentText && (
              <ConsentScreen
                body={consentText.body}
                version={consentText.version}
                companyName={interview.company?.name ?? null}
                companyLogoUrl={interview.company?.logo_url ?? null}
                onAgree={handleAgree}
                onDecline={handleDecline}
                busy={consentBusy}
              />
            )}

            {currentStep === 'install' && (
              <HelperDownloadCard checking={helper.checking} onRetry={() => helper.refresh()} />
            )}

            {currentStep === 'permissions' && (
              <SetupCard
                icon={<ShieldIcon sx={{ fontSize: 20 }} />}
                title="Grant permissions"
                subtitle="Enable each permission for Trueyy Helper, then this page updates automatically."
              >
                {monitoringState === 'pending' ? (
                  <Status busy text="Connecting to helper…" />
                ) : (
                  <>
                    <PermissionRow title="Screen Recording" desc="Required for app / window monitoring"
                      done={screenOk} onEnable={openScreenRecordingSettings} />
                    <PermissionRow title="Microphone" desc="Required for live transcription"
                      done={micOk} onEnable={openMicSettings} />
                    <PermissionRow title="Keyboard Access" desc="Required for keyboard activity monitoring"
                      done={keyboardOk} onEnable={openKeyboardSettings} />
                    <Caption sx={{ display: 'block', color: TOKENS.textSecondary, mt: 1.5 }}>
                      {detectHelperPlatform() === 'windows'
                        ? <>Enable <strong>Microphone access</strong> (and <strong>Let desktop apps access your microphone</strong>) in Windows Settings, then return here.</>
                        : <>Toggle <strong>Trueyy Helper</strong> ON in each pane, then return here.</>}
                    </Caption>
                  </>
                )}
              </SetupCard>
            )}

            {currentStep === 'join' && (
              <SetupCard
                icon={<VideoCallIcon sx={{ fontSize: 20 }} />}
                title={meetingOpened ? 'You’re all set' : 'Join your meeting'}
                subtitle={meetingOpened
                  ? 'Keep this tab open while you interview — monitoring runs in the background.'
                  : 'Monitoring is active. Open the meeting to begin.'}
              >
                {meetingOpened ? (
                  <Status ok text="Meeting opened — keep this tab open" />
                ) : (
                  <ActionButton
                    startIcon={<VideoCallIcon sx={{ fontSize: 18 }} />}
                    onClick={handleOpenMeeting}
                    disabled={!interview.provider_metadata?.join_url}
                  >
                    Open meeting
                  </ActionButton>
                )}
                {/* Withdraw stays on the Join step only — this is where
                    monitoring is actually running, and GDPR Art. 7(3)
                    requires it to remain available while monitored. */}
                <Box sx={{ mt: 2.5 }}>
                  <Button
                    size="small" color="inherit"
                    sx={{ color: TOKENS.textSecondary, textTransform: 'none', fontSize: '0.78rem' }}
                    onClick={() => setWithdrawOpen(true)}
                  >
                    Withdraw monitoring consent
                  </Button>
                </Box>
              </SetupCard>
            )}
          </Box>
        </>
      )}

      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)}>
        <DialogTitle>Withdraw monitoring consent?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your interviewer will be notified immediately and recording will stop.
            The interview may end as a result. Data recorded so far is kept.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleWithdraw} disabled={consentBusy}>Withdraw consent</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** A plain white setup card (permissions / join) matching ConsentScreen's
 *  visual weight so the stepped flow feels consistent. */
function SetupCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <Box sx={{
      width: 460, maxWidth: '100%', bgcolor: TOKENS.bgCard,
      borderRadius: '16px', border: `1px solid ${TOKENS.border}`,
      boxShadow: '0 4px 24px rgba(17, 24, 39, 0.06)', p: { xs: 3, md: 3.5 },
    }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: '11px', mb: 1.75,
        bgcolor: TOKENS.brandBg, color: BRAND,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </Box>
      <CardTitle component="h2" sx={{ m: 0, mb: 0.5, fontWeight: 700 }}>{title}</CardTitle>
      <Secondary sx={{ color: TOKENS.textSecondary, mb: 2.5 }}>{subtitle}</Secondary>
      {children}
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
        {/* Was a literal '⏳' emoji which renders inconsistently across
            platforms (Apple/Win/Linux glyphs differ) and has no
            accessible name. PendingIcon (Schedule outline) is part of
            MUI's icon set so it inherits the same look as CheckIcon. */}
        {done ? <CheckIcon sx={{ fontSize: 14 }} /> : <PendingIcon sx={{ fontSize: 14 }} />}
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
