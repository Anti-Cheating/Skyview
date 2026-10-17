/**
 * MeetingLinkField — provider-aware meeting selector used by every
 * round-scheduling form (CreateProcessPage + RoundDialog).
 *
 * It does NOT create anything itself. It emits a `MeetingSelection`; the
 * parent form sends it on Save:
 *   - googleAuto → `generate_meet: true`; Cortex creates the calendar event
 *     (or keeps the round's existing one) and stores the link.
 *   - manual     → the pasted `meeting_link`.
 *
 * This "generate on save" model means exactly one calendar event per
 * interview: created on save, patched on edit, deleted on cancel/replace —
 * no duplicate events, no "regenerate" button.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Link, MenuItem, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { FormField } from './FormField';
import { TOKENS } from '../../theme';
import { ENV } from '../../config/env';
import {
  IntegrationsService,
  type GoogleConnectionStatus,
} from '../../services/integrations.service';

export type MeetingProvider = 'google_meet' | 'zoom' | 'teams' | 'other';

export interface MeetingSelection {
  provider: MeetingProvider;
  /** Pasted link for manual providers; '' when googleAuto. */
  link: string;
  /** True = generate a Google Meet link on save (Google Meet + connected). */
  googleAuto: boolean;
}

// Origin of the Cortex API — validates the connect popup's postMessage.
export const CORTEX_ORIGIN = (() => {
  try {
    return new URL(ENV.AUTH_API_URL).origin;
  } catch {
    return '';
  }
})();

/** Detect the provider of an existing (edit-mode) link. */
export function detectProvider(link: string): MeetingProvider {
  const l = (link || '').toLowerCase();
  if (l.includes('meet.google.com')) return 'google_meet';
  if (l.includes('zoom.us')) return 'zoom';
  if (l.includes('teams.microsoft.com') || l.includes('teams.live.com')) return 'teams';
  return link ? 'other' : 'google_meet';
}

interface MeetingLinkFieldProps {
  value: MeetingSelection;
  onChange: (sel: MeetingSelection) => void;
  disabled?: boolean;
  /** True in edit mode when the round already owns a generated Meet event. */
  hasExistingEvent?: boolean;
}

const PROVIDERS: Array<{ value: MeetingProvider; label: string }> = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'other', label: 'Other — paste a link' },
];

export function MeetingLinkField({ value, onChange, disabled, hasExistingEvent }: MeetingLinkFieldProps) {
  const [gStatus, setGStatus] = useState<GoogleConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; msg: string } | null>(null);

  const statusFetched = useRef(false);
  const refreshStatus = async () => {
    try {
      setGStatus(await IntegrationsService.googleStatus());
    } catch {
      /* keep prior */
    }
  };
  useEffect(() => {
    if (statusFetched.current) return;
    statusFetched.current = true;
    (async () => {
      try {
        setGStatus(await IntegrationsService.googleStatus());
      } catch {
        setGStatus({ connected: false, accountEmail: null });
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  // Once the connection status resolves, reflect it into the selection: a
  // fresh Google-Meet form with no pasted link becomes "auto" when connected.
  // One-shot (ref-guarded) so it can't fight the user's later choices.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (statusLoading || syncedRef.current) return;
    syncedRef.current = true;
    if (value.provider === 'google_meet' && !value.link && gStatus?.connected && !value.googleAuto) {
      onChange({ provider: 'google_meet', link: '', googleAuto: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLoading]);

  // Popup connect: postMessage back from the Cortex callback keeps this form
  // intact (no navigation). When connected, flip Google Meet into auto mode.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (CORTEX_ORIGIN && e.origin !== CORTEX_ORIGIN) return;
      const data = e.data as { source?: string; status?: string } | null;
      if (!data || data.source !== 'trueyy-google') return;
      if (data.status === 'connected') {
        setNotice({ kind: 'success', msg: 'Google Calendar connected.' });
        void refreshStatus();
        if (value.provider === 'google_meet') onChange({ provider: 'google_meet', link: '', googleAuto: true });
      } else if (data.status === 'denied') {
        setNotice({ kind: 'info', msg: 'Google connection was cancelled.' });
      } else {
        setNotice({ kind: 'error', msg: "Couldn't connect Google — try again or paste a link." });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.provider]);

  const connect = async () => {
    const popup = window.open('', 'trueyy-google-connect', 'width=520,height=680');
    try {
      const url = await IntegrationsService.getGoogleConsentUrl();
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      popup?.close();
      setNotice({ kind: 'error', msg: e?.message || 'Could not start Google connection' });
    }
  };

  const connected = !!gStatus?.connected;

  const setProvider = (provider: MeetingProvider) => {
    setNotice(null);
    if (provider === 'google_meet') {
      onChange({ provider, link: connected ? '' : value.link, googleAuto: connected });
    } else {
      onChange({ provider, link: value.link, googleAuto: false });
    }
  };

  const pasteField = (
    <FormField
      label="Meeting Link"
      required
      placeholder="https://meet.google.com/abc-defg-hij"
      value={value.link}
      onChange={(e) => onChange({ ...value, link: e.target.value, googleAuto: false })}
      disabled={disabled}
    />
  );

  return (
    <Stack spacing={1.5}>
      <FormField
        label="Meeting provider"
        select
        value={value.provider}
        onChange={(e) => setProvider(e.target.value as MeetingProvider)}
        disabled={disabled}
      >
        {PROVIDERS.map((p) => (
          <MenuItem key={p.value} value={p.value}>
            {p.label}
          </MenuItem>
        ))}
      </FormField>

      {notice && (
        <Alert severity={notice.kind} onClose={() => setNotice(null)} sx={{ py: 0.25 }}>
          {notice.msg}
        </Alert>
      )}

      {value.provider === 'google_meet' && (
        <Box>
          {statusLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
              <CircularProgress size={16} sx={{ color: TOKENS.brand }} />
              <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
                Checking Google connection…
              </Typography>
            </Box>
          ) : connected ? (
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon sx={{ fontSize: 15, color: TOKENS.brand }} />
                <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
                  {hasExistingEvent
                    ? 'A Google Meet link is set — saving updates the calendar event.'
                    : 'A Google Meet link + calendar invite are created when you save.'}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary, pl: 2.75 }}>
                On {gStatus?.accountEmail}&apos;s calendar ·{' '}
                <Link component="button" type="button" onClick={connect} sx={{ fontSize: '0.75rem' }}>
                  Switch account
                </Link>
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Box>
                <Link component="button" type="button" onClick={connect} sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Connect Google Calendar
                </Link>{' '}
                <Typography component="span" sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary }}>
                  to auto-create the link, or paste one below.
                </Typography>
              </Box>
              {pasteField}
            </Stack>
          )}
        </Box>
      )}

      {(value.provider === 'zoom' || value.provider === 'teams') && (
        <Stack spacing={1}>
          <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary }}>
            Auto-generation for {value.provider === 'zoom' ? 'Zoom' : 'Microsoft Teams'} is coming soon —
            paste your link for now.
          </Typography>
          {pasteField}
        </Stack>
      )}

      {value.provider === 'other' && pasteField}
    </Stack>
  );
}
