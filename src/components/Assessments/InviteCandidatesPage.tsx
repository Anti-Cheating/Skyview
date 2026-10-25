import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { MdAdd, MdDeleteOutline, MdUploadFile } from 'react-icons/md';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { Breadcrumb } from '../common/Breadcrumb';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { LABEL_SX, DATETIME_SLOT_PROPS } from '../common/formTokens';
import { PageTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, InviteCandidate } from '../../types/assessment.types';
import { formatDuration } from './AssessmentsListPage';
import { EMAIL_RE, readCandidateFile } from './candidateFile';

type Row = { email: string; first_name: string; last_name: string };
const EMPTY: Row = { email: '', first_name: '', last_name: '' };
const MAX = 200;

function Required() {
  return <Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>*</Box>;
}

/** /assessments/:id/invite — candidates (typed or from CSV / Excel) + the schedule they get. */
export default function InviteCandidatesPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useSnackbar();
  const file = useRef<HTMLInputElement>(null);

  const [a, setA] = useState<Assessment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // ?email=&first=&last= prefills one candidate (e.g. "Assign take-home" from a result).
  const [params] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([{ email: params.get('email') ?? '', first_name: params.get('first') ?? '', last_name: params.get('last') ?? '' }]);
  const [opens, setOpens] = useState<Dayjs | null>(dayjs().add(1, 'hour').startOf('hour'));
  const [closes, setCloses] = useState<Dayjs | null>(null);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AssessmentService.get(id)
      .then((r) => {
        if (!r.data) return setLoadError('Assessment not found');
        setA(r.data);
        const start = dayjs().add(1, 'hour').startOf('hour');
        setCloses(r.data.mode === 'live' ? start.add(Math.max(r.data.duration_min * 2, 240), 'minute') : dayjs().add(3, 'day').endOf('day'));
      })
      .catch((e) => setLoadError(e?.message || 'Could not load the assessment'));
  }, [id]);

  if (loadError) return <Box sx={{ p: 3 }}><Alert severity="error">{loadError}</Alert></Box>;
  if (!a) return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;

  const live = a.mode === 'live';
  const back = `/assessments/${a.id}`;
  const filled = rows.filter((r) => r.email.trim());
  const badEmail = (r: Row) => !!r.email.trim() && !EMAIL_RE.test(r.email.trim());
  const dupes = new Set(
    filled.map((r) => r.email.trim().toLowerCase()).filter((e, i, all) => all.indexOf(e) !== i)
  );

  const problem =
    filled.length === 0 ? 'Add at least one candidate email'
    : filled.some(badEmail) ? 'Fix the emails marked in red'
    : filled.length > MAX ? `Invite at most ${MAX} candidates at a time`
    : !closes || (live && !opens) ? 'Set the schedule'
    : live && closes.diff(opens, 'minute') < a.duration_min ? `The window must be at least ${formatDuration('live', a.duration_min)} long`
    : closes.isBefore(dayjs()) ? 'The closing time is in the past'
    : null;

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const { candidates, invalid } = await readCandidateFile(f);
      const have = new Set(filled.map((r) => r.email.trim().toLowerCase()));
      const fresh = candidates.filter((c) => !have.has(c.email.toLowerCase()));
      const next = [...filled, ...fresh.map((c) => ({ email: c.email, first_name: c.first_name ?? '', last_name: c.last_name ?? '' }))];
      setRows(next.length ? next : [{ ...EMPTY }]);
      const notes = [`Added ${fresh.length} candidate${fresh.length === 1 ? '' : 's'} from ${f.name}`];
      if (candidates.length > fresh.length) notes.push(`${candidates.length - fresh.length} already in the list`);
      if (invalid.length) notes.push(`skipped row${invalid.length > 1 ? 's' : ''} ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''} (no valid email)`);
      (fresh.length ? showSuccess : showError)(notes.join(' · '));
    } catch (e: any) {
      showError(e?.message || "Couldn't read that file. Use a .csv or .xlsx with an email column.");
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const send = async () => {
    setTouched(true);
    if (problem) return showError(problem);
    setSaving(true);
    try {
      const seen = new Set<string>();
      const candidates: InviteCandidate[] = [];
      for (const r of filled) {
        const email = r.email.trim();
        if (seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        candidates.push({ email, ...(r.first_name.trim() && { first_name: r.first_name.trim() }), ...(r.last_name.trim() && { last_name: r.last_name.trim() }) });
      }
      const r = await AssessmentService.invite(a.id, candidates, closes!.toISOString(), live ? opens!.toISOString() : undefined);
      const d = r.data!;
      const parts = [`Invited ${d.invited}`];
      if (d.skipped.length) parts.push(`${d.skipped.length} already invited`);
      if (d.failed.length) parts.push(...d.failed.map((x) => x.error));
      const unsent = d.invited - d.emails_sent;
      if (unsent) parts.push(`${unsent} email${unsent > 1 ? 's' : ''} not sent, use Resend`);
      (d.failed.length || unsent ? showError : showSuccess)(parts.join(' · '));
      navigate(back);
    } catch (e: any) {
      showError(e?.message || 'Could not send the invites');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.75 }}>Invite candidates</PageTitle>
      <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: a.title, to: back }, { label: 'Invite candidates' }]} />
      <Secondary sx={{ color: TOKENS.textSecondary, mb: 3 }}>
        Add candidates by email or upload a list, then choose when they can take {a.title}. Each one gets their own link.
      </Secondary>

      {a.status !== 'final' ? (
        <Alert severity="info" sx={{ borderRadius: '10px' }}>
          Finalize the paper before inviting candidates. <Box component="a" href={back} sx={{ color: TOKENS.success, fontWeight: 600 }}>Back to the paper</Box>
        </Alert>
      ) : (
        <Box sx={{ borderRadius: '16px', border: `1px solid ${TOKENS.border}`, bgcolor: '#fff', overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Candidates */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary }}>Candidates</Typography>
                <Secondary sx={{ color: TOKENS.textSecondary }}>
                  Only the email is required. A file needs an <b>email</b> column; <b>first name</b>, <b>last name</b> or <b>name</b> columns are used if present.
                </Secondary>
              </Box>
              <input ref={file} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
                onChange={(e) => upload(e.target.files?.[0])} />
              <ActionButton variant="secondary" startIcon={<MdUploadFile />} loading={uploading} onClick={() => file.current?.click()}>
                Upload CSV or Excel
              </ActionButton>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 40px', gap: 2 }}>
                <Box sx={LABEL_SX}><span>Candidate Email</span><Required /></Box>
                <Box sx={LABEL_SX}><span>First Name</span><Box component="span" sx={{ color: TOKENS.textMuted, fontWeight: 400 }}>(optional)</Box></Box>
                <Box sx={LABEL_SX}><span>Last Name</span><Box component="span" sx={{ color: TOKENS.textMuted, fontWeight: 400 }}>(optional)</Box></Box>
                <span />
              </Box>
              {rows.map((r, i) => {
                const err = (touched || r.email.includes('@')) && badEmail(r);
                const dup = dupes.has(r.email.trim().toLowerCase()) && rows.findIndex((x) => x.email.trim().toLowerCase() === r.email.trim().toLowerCase()) !== i;
                return (
                  <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 40px', md: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 40px' }, gap: { xs: 1, md: 2 }, alignItems: 'start' }}>
                    <FormField type="email" placeholder="candidate@example.com" value={r.email} onChange={(e) => setRow(i, { email: e.target.value })}
                      error={err} helperText={err ? 'Not a valid email' : dup ? 'Already in the list' : undefined} disabled={saving}
                      inputProps={{ 'aria-label': `Candidate ${i + 1} email` }} />
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <FormField placeholder="John" value={r.first_name} onChange={(e) => setRow(i, { first_name: e.target.value })} disabled={saving}
                        inputProps={{ 'aria-label': `Candidate ${i + 1} first name` }} />
                    </Box>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <FormField placeholder="Smith" value={r.last_name} onChange={(e) => setRow(i, { last_name: e.target.value })} disabled={saving}
                        inputProps={{ 'aria-label': `Candidate ${i + 1} last name` }} />
                    </Box>
                    <Tooltip title="Remove">
                      <span>
                        <IconButton aria-label={`Remove candidate ${i + 1}`} disabled={saving || rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} sx={{ mt: 0.5 }}>
                          <MdDeleteOutline />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ActionButton variant="secondary" size="small" startIcon={<MdAdd />} disabled={saving || rows.length >= MAX} onClick={() => setRows([...rows, { ...EMPTY }])}>
                  Add candidate
                </ActionButton>
                <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary }}>
                  {filled.length} candidate{filled.length === 1 ? '' : 's'}
                </Typography>
              </Box>
            </Box>

            {/* Schedule */}
            <Box sx={{ borderTop: `1px solid ${TOKENS.border}`, pt: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>Schedule</Typography>
              <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>
                {live
                  ? `Live · each candidate gets ${formatDuration('live', a.duration_min)} from when they start, with the Trueyy Helper on, and must finish before the window closes.`
                  : `Take-home · once they start, they get ${formatDuration('take_home', a.duration_min)} to finish.`}
              </Secondary>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
                  {live && (
                    <Box>
                      <Box sx={LABEL_SX}><span>Can start from</span><Required /></Box>
                      <DateTimePicker value={opens} onChange={setOpens} disabled={saving} minDateTime={dayjs()} timeSteps={{ hours: 1, minutes: 1 }} slotProps={DATETIME_SLOT_PROPS} />
                    </Box>
                  )}
                  <Box>
                    <Box sx={LABEL_SX}><span>{live ? 'Must finish by' : 'Must start by'}</span><Required /></Box>
                    <DateTimePicker value={closes} onChange={setCloses} disabled={saving} minDateTime={(live ? opens : null) ?? dayjs()} timeSteps={{ hours: 1, minutes: 1 }} slotProps={DATETIME_SLOT_PROPS} />
                  </Box>
                </Box>
              </LocalizationProvider>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {touched && problem && <Typography sx={{ fontSize: '0.85rem', color: TOKENS.error, mr: 'auto' }}>{problem}</Typography>}
              <ActionButton variant="secondary" onClick={() => navigate(back)} disabled={saving}>Cancel</ActionButton>
              <ActionButton onClick={send} loading={saving} disabled={saving}>
                Send {filled.length > 1 ? `${filled.length} invites` : 'invite'}
              </ActionButton>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
