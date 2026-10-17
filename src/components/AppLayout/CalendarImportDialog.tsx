/**
 * CalendarImportDialog — the calendar "Import" button on the Interviews page.
 *
 * Cortex reads upcoming Google Calendar events into the same fields as New
 * interview (title, candidate, interviewers, link, time). The manager ticks
 * the events to import; each becomes an interview with Round 1, through the
 * same backend path as New interview (quota, invites, join links).
 *
 * Only team members can be interviewers — anyone else from the company is
 * shown as skipped. When two or more people from outside the company are
 * invited, the manager picks the candidate from a dropdown.
 *
 * With `process` (opened beside Add round), the candidate is fixed to that
 * interview's candidate and each picked event becomes its next round.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import { TOKENS } from '../../theme';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { CORTEX_ORIGIN } from '../common/MeetingLinkField';
import { IntegrationsService, type GoogleConnectionStatus } from '../../services/integrations.service';
import { ProcessService, type CalendarDraft } from '../../services/process.service';
import { useSnackbar } from '../../contexts/SnackbarContext';

type Status = CalendarDraft['status'];

const IMPORTABLE = new Set<Status>(['ready', 'pick_candidate']);

const TONES = {
  ok: { bgcolor: 'rgba(76, 217, 100, 0.14)', color: TOKENS.success },
  warn: { bgcolor: 'rgba(250, 204, 21, 0.2)', color: '#92400E' },
  mute: { bgcolor: TOKENS.borderLight, color: TOKENS.textSecondary },
};

const STATUS_CHIP: Record<Status, { label: string; tone: keyof typeof TONES }> = {
  ready: { label: 'Ready', tone: 'ok' },
  pick_candidate: { label: 'Pick the candidate', tone: 'warn' },
  not_interview: { label: 'No candidate', tone: 'mute' },
  no_interviewer: { label: 'No interviewer', tone: 'mute' },
  no_link: { label: 'No meeting link', tone: 'mute' },
  already_imported: { label: 'Already imported', tone: 'mute' },
  candidate_not_invited: { label: 'Candidate not invited', tone: 'mute' },
};

const STATUS_HINT: Partial<Record<Status, string>> = {
  not_interview: 'Everyone invited is from your company, so there is no candidate.',
  no_interviewer: 'No one on your Trueyy team is invited. Add the interviewer on the Team page, then fetch again.',
  no_link: 'Add a Meet, Zoom or Teams link to the event, then fetch again.',
  candidate_not_invited: "This interview's candidate isn't invited to this event.",
};

const DAY_OPTIONS = [7, 14, 30];

interface Choice {
  checked: boolean;
  /** Role for a new interview, or the round name when adding rounds. */
  name: string;
  candidate: string;
  error?: string;
}

const personName = (c: { email: string; first_name?: string; last_name?: string }) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ').trim();

export function CalendarImportDialog({
  process,
  onClose,
  onImported,
}: {
  /** Set when adding rounds to an existing interview. */
  process?: { id: string; candidateName: string };
  onClose: () => void;
  /** Called with how many interviews were created, so the page can refresh. */
  onImported: (count: number) => void;
}) {
  const [gStatus, setGStatus] = useState<GoogleConnectionStatus | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CalendarDraft[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [importing, setImporting] = useState(false);
  const { showSuccess } = useSnackbar();

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await ProcessService.calendarEvents(d, process?.id);
      setDrafts(r.drafts);
      setTimezone(r.timezone);
      setChoices(
        Object.fromEntries(
          r.drafts.map((x) => [
            x.event_id,
            {
              checked: x.status === 'ready',
              name: x.title,
              candidate: x.candidates.length === 1 ? x.candidates[0]!.email : '',
            },
          ]),
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Couldn't read your Google Calendar. Try again.");
    } finally {
      setLoading(false);
    }
  }, [process?.id]);

  // Connection first; events load once Google is connected.
  useEffect(() => {
    IntegrationsService.googleStatus()
      .then(setGStatus)
      .catch(() => setGStatus({ connected: false, accountEmail: null }));
  }, []);
  useEffect(() => {
    if (gStatus?.connected) void load(days);
  }, [gStatus?.connected, days, load]);

  // Popup connect — same postMessage handshake as the Meeting field.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (CORTEX_ORIGIN && e.origin !== CORTEX_ORIGIN) return;
      const data = e.data as { source?: string; status?: string } | null;
      if (!data || data.source !== 'trueyy-google') return;
      if (data.status === 'connected') {
        IntegrationsService.googleStatus().then(setGStatus).catch(() => {});
      } else {
        setError(data.status === 'denied' ? 'Google connection was cancelled.' : "Couldn't connect Google. Try again.");
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const connect = async () => {
    setError(null);
    const popup = window.open('', 'trueyy-google-connect', 'width=520,height=680');
    try {
      const url = await IntegrationsService.getGoogleConsentUrl();
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      popup?.close();
      setError(e?.message || 'Could not start Google connection');
    }
  };

  const setChoice = (id: string, patch: Partial<Choice>) =>
    setChoices((c) => ({ ...c, [id]: { ...c[id]!, ...patch, error: undefined } }));

  const selected = drafts.filter((d) => IMPORTABLE.has(d.status) && choices[d.event_id]?.checked);
  const incomplete = selected.some((d) => !choices[d.event_id]!.candidate || !choices[d.event_id]!.name.trim());

  const submit = async () => {
    setImporting(true);
    setError(null);
    try {
      const results = await ProcessService.importCalendar(
        selected.map((d) => {
          const c = choices[d.event_id]!;
          return {
            event_id: d.event_id,
            ...(process ? { round_name: c.name.trim() } : { role: c.name.trim() }),
            ...(d.candidates.length > 1 ? { candidate_email: c.candidate } : {}),
          };
        }),
        timezone,
        process?.id,
      );
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.event_id));
      if (okIds.size) {
        onImported(okIds.size);
        const n = okIds.size;
        showSuccess(
          process
            ? `Added ${n} round${n === 1 ? '' : 's'} from Google Calendar.`
            : `Imported ${n} interview${n === 1 ? '' : 's'} from Google Calendar.`,
        );
      }
      if (okIds.size === results.length) {
        onClose();
        return;
      }
      // Keep the dialog open on the ones that failed, with their reason.
      setDrafts((ds) => ds.map((d) => (okIds.has(d.event_id) ? { ...d, status: 'already_imported' } : d)));
      setChoices((cs) => {
        const next = { ...cs };
        for (const r of results) {
          next[r.event_id] = { ...next[r.event_id]!, checked: !r.ok, error: r.ok ? undefined : r.error };
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message || 'Import failed. Try again.');
    } finally {
      setImporting(false);
    }
  };

  const body = () => {
    if (!gStatus || (gStatus.connected && loading)) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress size={24} sx={{ color: TOKENS.brand }} />
        </Box>
      );
    }
    if (!gStatus.connected) {
      return (
        <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>
            Connect the Google account whose calendar has your interviews. It's the same connection used for
            auto-generated Meet links.
          </Typography>
          <ActionButton onClick={connect}>Connect Google Calendar</ActionButton>
        </Box>
      );
    }
    if (drafts.length === 0) {
      return (
        <Typography sx={{ py: 4, fontSize: '0.875rem', color: TOKENS.textSecondary, textAlign: 'center' }}>
          {process
            ? `No upcoming events invite ${process.candidateName} in the next ${days} days.`
            : `No upcoming events with guests in the next ${days} days.`}
        </Typography>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {drafts.map((d) => (
          <DraftRow
            key={d.event_id}
            draft={d}
            choice={choices[d.event_id]!}
            nameLabel={process ? 'Round name' : 'Role'}
            disabled={importing}
            onChange={(patch) => setChoice(d.event_id, patch)}
          />
        ))}
      </Box>
    );
  };

  return (
    <Dialog open onClose={importing ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.125rem' }}>Import from Google Calendar</Typography>
          {gStatus?.connected && (
            <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
              {gStatus.accountEmail} · {drafts.length} event{drafts.length === 1 ? '' : 's'}{' '}
              {process ? `with ${process.candidateName}` : 'with guests'}
            </Typography>
          )}
          {process && (
            <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
              Picked events become the next rounds for {process.candidateName}.
            </Typography>
          )}
        </Box>
        {gStatus?.connected && (
          <FormField
            select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={loading || importing}
            wrapperSx={{ minWidth: 150 }}
            inputProps={{ 'aria-label': 'Date range' }}
          >
            {DAY_OPTIONS.map((n) => (
              <MenuItem key={n} value={String(n)}>Next {n} days</MenuItem>
            ))}
          </FormField>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {body()}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ flex: 1, minWidth: 200, fontSize: '0.75rem', color: TOKENS.textSecondary }}>
          {process ? 'Each round gets the same emails as Add round' : 'Each interview gets the same emails as New interview'}:
          the candidate's join link and every interviewer's monitoring link. Your Google event is left as it is.
        </Typography>
        <ActionButton variant="secondary" onClick={onClose} disabled={importing}>Cancel</ActionButton>
        <ActionButton onClick={submit} loading={importing} disabled={selected.length === 0 || incomplete}>
          {selected.length === 0
            ? 'Import'
            : process
              ? `Add ${selected.length} round${selected.length === 1 ? '' : 's'}`
              : `Import ${selected.length} interview${selected.length === 1 ? '' : 's'}`}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

function DraftRow({
  draft: d,
  choice,
  nameLabel,
  disabled,
  onChange,
}: {
  draft: CalendarDraft;
  choice: Choice;
  nameLabel: string;
  disabled: boolean;
  onChange: (patch: Partial<Choice>) => void;
}) {
  const importable = IMPORTABLE.has(d.status);
  const chip = STATUS_CHIP[d.status];
  const notOnTeam = d.skipped.filter((s) => s.reason === 'not_on_team').map((s) => s.email);
  const when = `${dayjs(d.start).format('ddd D MMM · h:mm A')} – ${dayjs(d.end).format('h:mm A')}`;
  const onlyCandidate = d.candidates.length === 1 ? d.candidates[0]! : null;
  // Details open / close on their own, for any event, independent of the tick.
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        p: 1.5,
        borderRadius: '10px',
        border: `1px solid ${choice.checked ? TOKENS.brand : TOKENS.border}`,
        opacity: importable ? 1 : 0.65,
      }}
    >
      <Checkbox
        size="small"
        checked={choice.checked}
        disabled={!importable || disabled}
        onChange={(e) => {
          onChange({ checked: e.target.checked });
          // Ticking an event that still needs a candidate opens it at the dropdown.
          if (e.target.checked && !choice.candidate) setOpen(true);
        }}
        inputProps={{ 'aria-label': `Import ${d.title}` }}
        sx={{ p: 0.5, alignSelf: 'flex-start', '&.Mui-checked': { color: TOKENS.brand } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box onClick={toggle} sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textPrimary, overflowWrap: 'anywhere' }}>
                {d.title}
              </Typography>
              <Chip size="small" label={chip.label} sx={{ ...TONES[chip.tone], fontWeight: 600, fontSize: '0.6875rem', height: 22 }} />
            </Box>
            <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
              {when} · {d.interviewers.length} interviewer{d.interviewers.length === 1 ? '' : 's'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? `Hide details of ${d.title}` : `Show details of ${d.title}`}
            sx={{ mt: -0.25 }}
          >
            <ExpandIcon sx={{ fontSize: 20, transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }} />
          </IconButton>
        </Box>

        {STATUS_HINT[d.status] && (
          <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: TOKENS.textSecondary }}>{STATUS_HINT[d.status]}</Typography>
        )}
        {notOnTeam.length > 0 && d.status !== 'already_imported' && (
          <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: '#92400E' }}>
            {notOnTeam.join(', ')} {notOnTeam.length === 1 ? "isn't" : "aren't"} on your Trueyy team, so{' '}
            {notOnTeam.length === 1 ? "they can't be an interviewer" : "they can't be interviewers"}. Add them on the
            Team page, then fetch again to include them.
          </Typography>
        )}

        <Collapse in={open} unmountOnExit>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${TOKENS.border}`, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <FormField
              label={nameLabel}
              required
              value={choice.name}
              onChange={(e) => onChange({ name: e.target.value })}
              disabled={disabled}
              locked={!importable}
              hint={importable ? 'From the event title. Change it if you like.' : undefined}
            />
            {d.candidates.length === 0 ? (
              <FormField label="Candidate" locked value="No one from outside your company is invited" />
            ) : onlyCandidate ? (
              <FormField
                label="Candidate"
                locked
                value={personName(onlyCandidate) ? `${personName(onlyCandidate)} · ${onlyCandidate.email}` : onlyCandidate.email}
              />
            ) : (
              <FormField
                label="Candidate"
                required
                select
                value={choice.candidate}
                onChange={(e) => onChange({ candidate: e.target.value })}
                disabled={disabled || !importable}
                hint="More than one person from outside your company is invited. Pick the candidate."
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (v) =>
                    (v as string) || <Box component="span" sx={{ color: TOKENS.textMuted }}>Pick the candidate</Box>,
                }}
              >
                {d.candidates.map((c) => (
                  <MenuItem key={c.email} value={c.email}>
                    {personName(c) ? `${personName(c)} · ${c.email}` : c.email}
                  </MenuItem>
                ))}
              </FormField>
            )}
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.75 }}>Interviewers</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {d.interviewers.map((i) => (
                  <Chip key={i.id} size="small" label={`${i.name} · ${i.email}`} sx={{ bgcolor: TONES.ok.bgcolor, color: TOKENS.textPrimary }} />
                ))}
                {d.interviewers.length === 0 && (
                  <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>No one on your Trueyy team is invited.</Typography>
                )}
              </Box>
            </Box>
            <FormField label="Meeting Link" locked value={d.meeting_link ?? 'No meeting link in the event'} wrapperSx={{ gridColumn: '1 / -1' }} />
            <FormField label="Start" locked value={dayjs(d.start).format('ddd, D MMM YYYY · h:mm A')} />
            <FormField label="Duration" locked value={`${d.duration_minutes} minutes`} />
            <FormField label="Timezone" locked value={d.timezone} />
            {d.description && (
              <FormField label="Description" locked multiline maxRows={4} value={d.description} wrapperSx={{ gridColumn: '1 / -1' }} />
            )}
          </Box>
        </Collapse>

        {choice.error && (
          <Typography sx={{ mt: 1, fontSize: '0.75rem', color: TOKENS.error }}>{choice.error}</Typography>
        )}
      </Box>
    </Box>
  );
}
