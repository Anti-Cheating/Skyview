import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { useHelper, type UseHelperReturn } from '../../hooks/useHelper';
import { detectHelperPlatform, openSettingsPane, requestHelperPermission } from '../../services/helperBridge';
import { ConsentService, type ConsentText } from '../../services/consent.service';
import { STORAGE_KEYS } from '../../config/constants';
import { ENV } from '../../config/env';
import { TOKENS } from '../../theme';
import { Caption } from '../layout/Typography';
import HelperDownloadCard from '../Monitoring/HelperDownloadCard';
import ConsentScreen from '../Consent/ConsentScreen';
import ConsentOutcome from '../Consent/ConsentOutcome';
import JoinStepper, { type JoinStep } from '../Consent/JoinStepper';
import { PermissionRow, SetupCard, Status } from '../AppLayout/CandidateJoinPage';

type Ids = { session_id: string; participant_id: string };
type Consent = 'loading' | 'needed' | 'given' | 'declined' | 'revoked';

interface AssessmentHelperState {
  helper: UseHelperReturn;
  consent: Consent;
  consentText: ConsentText | null;
  /** Consent given, Helper installed + current, all three permissions on, and bound to this session. */
  ready: boolean;
  step: JoinStep;
  error: string | null;
  busy: boolean;
  agree: () => Promise<void>;
  decline: () => Promise<void>;
  reviewAgain: () => Promise<void>;
}

/**
 * The Trueyy Helper for a Live assessment: same consent → install →
 * permissions → bind flow as the interview join page. Cortex only ever
 * starts app/keyboard alerts and the microphone for these sessions.
 */
function useAssessmentHelper(ids: Ids): AssessmentHelperState {
  const helper = useHelper();
  const [consent, setConsent] = useState<Consent>('loading');
  const [consentText, setConsentText] = useState<ConsentText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionId = ids.session_id;

  const loadedFor = useRef<string | null>(null);
  const loadText = useCallback(async () => {
    if (!sessionId) return;
    const r = await ConsentService.text(sessionId);
    if (r.success && r.data) {
      setConsentText(r.data);
      setConsent(r.data.consented ? 'given' : 'needed');
    } else setError(r.message || 'Could not load the monitoring consent');
  }, [sessionId]);
  useEffect(() => {
    if (!sessionId || loadedFor.current === sessionId) return;
    loadedFor.current = sessionId;
    loadText().catch((e) => setError(e?.message || 'Could not load the monitoring consent'));
  }, [loadText, sessionId]);

  const agree = useCallback(async () => {
    if (!sessionId || !consentText) return;
    setBusy(true);
    try {
      const r = await ConsentService.grant(sessionId, consentText.version);
      if (r.success) setConsent('given');
      else if ((r as { error?: string }).error === 'stale_text') await loadText();
      else setError(r.message || 'Could not record your consent');
    } finally {
      setBusy(false);
    }
  }, [consentText, loadText, sessionId]);

  const decline = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await ConsentService.decline(sessionId);
      setConsent('declined');
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  // Bind the Helper to this session once it's allowed to run. Re-binds after
  // a reload or a Helper restart (its status loses the session id).
  useEffect(() => {
    if (consent !== 'given' || !helper.installed || helper.outdated) return;
    if (helper.status?.session_id === ids.session_id) return;
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
    if (!token) return;
    void helper.join({ session_id: ids.session_id, participant_id: ids.participant_id, role: 'candidate', token, cortex_url: ENV.AUTH_API_URL })
      .then((r) => { if (!r.ok) setError(r.error || 'Could not start the Trueyy Helper'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.session_id, consent, helper.installed, helper.outdated, helper.status?.session_id]);

  const s = helper.status;
  const permissions = !!s?.screen_recording_ok && !!s?.microphone_ok && !!s?.keyboard_ok;
  const step: JoinStep = consent !== 'given' ? 'consent' : !helper.installed || helper.outdated ? 'install' : !permissions ? 'permissions' : 'join';
  const ready = step === 'join' && s?.session_id === ids.session_id;
  return { helper, consent, consentText, ready, step, error, busy, agree, decline, reviewAgain: loadText };
}

/**
 * Setup screens shown before Start on a Live assessment. Renders
 * `children` (the welcome card with Start) once the Helper is ready.
 */
export function AssessmentHelperSteps({ ids, company, children }: { ids: Ids; company: string; children: ReactNode }) {
  const h = useAssessmentHelper(ids);
  const ask = (pane: 'screen_recording' | 'microphone' | 'accessibility') => async () => {
    if (!(await requestHelperPermission(pane))) await openSettingsPane(pane);
    void h.helper.refresh();
  };
  const s = h.helper.status;

  if (h.consent === 'loading') {
    return <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;
  }
  if (h.consent === 'declined' || h.consent === 'revoked') {
    return (
      <ConsentOutcome
        title="Monitoring declined"
        message={`This live assessment runs with the Trueyy Helper on. ${company} has been told you declined, and you can't start until you agree.`}
        actionLabel="I changed my mind — review again"
        onAction={() => void h.reviewAgain()}
      />
    );
  }

  // The welcome card (children) brings its own centred layout.
  if (h.ready) return <><JoinStepper current="join" lastLabel="Start" />{children}</>;
  return (
    <>
      <JoinStepper current={h.step} lastLabel="Start" />
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: { xs: 3, md: 5 }, px: { xs: 2, md: 3 }, pb: 3 }}>
        {h.step === 'consent' && h.consentText && (
          <ConsentScreen kind="assessment" body={h.consentText.body} version={h.consentText.version} companyName={company} companyLogoUrl={null}
            onAgree={h.agree} onDecline={h.decline} busy={h.busy} />
        )}
        {h.step === 'install' && (
          <HelperDownloadCard checking={h.helper.checking} onRetry={() => h.helper.refresh()}
            mode={h.helper.installed && h.helper.outdated ? 'update' : 'install'} latestVersion={h.helper.latestVersion} />
        )}
        {h.step === 'permissions' && (
          <SetupCard icon={<ShieldIcon sx={{ fontSize: 20 }} />} title="Grant permissions"
            subtitle="Enable each permission for Trueyy Helper, then this page updates automatically.">
            <PermissionRow title="Screen Recording" desc="Required for app / window monitoring"
              done={!!s?.screen_recording_ok} onEnable={ask('screen_recording')} />
            <PermissionRow title="Microphone" desc="Required for live transcription"
              done={!!s?.microphone_ok} onEnable={ask('microphone')} />
            <PermissionRow title="Keyboard Access" desc="Required for keyboard activity monitoring"
              done={!!s?.keyboard_ok} onEnable={ask('accessibility')} />
            <Caption sx={{ display: 'block', color: TOKENS.textSecondary, mt: 1.5 }}>
              {detectHelperPlatform() === 'windows'
                ? <>Enable <strong>Microphone access</strong> (and <strong>Let desktop apps access your microphone</strong>) in Windows Settings, then return here.</>
                : <>Toggle <strong>Trueyy Helper</strong> ON in each pane, then return here.</>}
            </Caption>
          </SetupCard>
        )}
        {h.step === 'join' && (
          <SetupCard icon={<ShieldIcon sx={{ fontSize: 20 }} />} title="Connecting the Trueyy Helper" subtitle="This takes a few seconds.">
            <Status busy={!h.error} err={!!h.error} text={h.error ?? 'Connecting…'} />
          </SetupCard>
        )}
      </Box>
    </>
  );
}

/**
 * During a started Live assessment: keeps the Helper bound (after a reload
 * it re-binds) and warns the candidate if it stops.
 */
export function HelperBanner({ ids }: { ids: Ids }) {
  const h = useAssessmentHelper(ids);
  if (h.ready || h.consent === 'loading' || (h.helper.checking && !h.helper.installed)) return null;
  return (
    <Box role="alert" sx={{ px: 2, py: 1, bgcolor: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#92400E', fontSize: '0.85rem', textAlign: 'center' }}>
      {h.consent !== 'given'
        ? 'Monitoring consent was withdrawn. The Trueyy Helper is off for the rest of this assessment.'
        : 'The Trueyy Helper isn\'t running. Open Trueyy Helper on this computer to keep going with monitoring on.'}
    </Box>
  );
}
