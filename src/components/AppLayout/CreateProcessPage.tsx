import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Alert, MenuItem, Typography } from '@mui/material';
import { Breadcrumb } from '../common/Breadcrumb';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { ProcessService } from '../../services/process.service';
import { InvitesService, type TeamMember } from '../../services/invites.service';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { INPUT_SX, LABEL_SX } from '../common/formTokens';
import { PageTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';

const DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1 hour 30 minutes' },
  { value: 120, label: '2 hours' },
];

export default function CreateProcessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();

  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [candidateFirstName, setCandidateFirstName] = useState('');
  const [candidateLastName, setCandidateLastName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  const [roundName, setRoundName] = useState('Technical');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [interviewerUserId, setInterviewerUserId] = useState('');
  const [startDateTime, setStartDateTime] = useState<Dayjs | null>(dayjs().add(1, 'hour').startOf('hour'));
  const [duration, setDuration] = useState(60);
  const [meetingLink, setMeetingLink] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.company_id) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await InvitesService.listMembers(user.company_id!, { pageSize: 100 });
        if (cancelled || !resp.success || !resp.data) return;
        const list = resp.data.items;
        setMembers(list);
        if (user?.id && list.some((m) => m.id === user.id)) {
          setInterviewerUserId((prev) => prev || user.id!);
        }
      } catch {
        /* dropdown stays empty; submit validation surfaces it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.company_id, user?.id]);

  const handleSubmit = async () => {
    if (!role.trim()) return setError('Role is required');
    if (!candidateFirstName.trim()) return setError('Candidate first name is required');
    if (!candidateLastName.trim()) return setError('Candidate last name is required');
    if (!candidateEmail.trim() || !candidateEmail.includes('@')) return setError('Valid candidate email is required');
    if (!roundName.trim()) return setError('Round name is required');
    if (!interviewerUserId) return setError('Please pick an interviewer');
    if (!startDateTime || !startDateTime.isValid()) return setError('Valid start date and time are required');
    if (startDateTime.isBefore(dayjs())) return setError('Start time must be in the future');
    if (!meetingLink.trim()) return setError('Meeting link is required');
    try {
      new URL(meetingLink.trim());
    } catch {
      return setError('Meeting link must be a valid URL');
    }

    setLoading(true);
    setError(null);
    try {
      const startAt = startDateTime.toDate();
      const endAt = new Date(startAt.getTime() + duration * 60 * 1000);
      const resp = await ProcessService.create({
        role: role.trim(),
        description: description.trim() || null,
        candidate_email: candidateEmail.trim().toLowerCase(),
        candidate_first_name: candidateFirstName.trim(),
        candidate_last_name: candidateLastName.trim(),
        first_round: {
          round_name: roundName.trim(),
          interviewer_user_id: interviewerUserId,
          scheduled_start_at: startAt.toISOString(),
          scheduled_end_at: endAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          meeting_link: meetingLink.trim(),
        },
      });
      if (resp.success && resp.data) {
        showSuccess('Interview created');
        navigate(`/interviews/${resp.data.id}`);
      } else {
        showError(resp.message || 'Failed to create interview');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to create interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.75 }}>New interview</PageTitle>
      <Breadcrumb items={[{ label: 'Interviews', to: '/interviews' }, { label: 'New interview' }]} />
      <Secondary sx={{ color: TOKENS.textSecondary, mb: 3 }}>
        Add the candidate and role, then schedule the first round. You can add more rounds later.
      </Secondary>

      <Box sx={{ borderRadius: '16px', border: `1px solid ${TOKENS.border}`, bgcolor: '#fff', overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary }}>Candidate &amp; role</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            <FormField label="Candidate First Name" required placeholder="John" value={candidateFirstName} onChange={(e) => setCandidateFirstName(e.target.value)} disabled={loading} />
            <FormField label="Candidate Last Name" required placeholder="Smith" value={candidateLastName} onChange={(e) => setCandidateLastName(e.target.value)} disabled={loading} />
            <FormField label="Candidate Email" required type="email" placeholder="candidate@example.com" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} disabled={loading} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <FormField label="Role" required placeholder="e.g. SDE-1" value={role} onChange={(e) => setRole(e.target.value)} disabled={loading} />
            <FormField label="Description" optional placeholder="Round plan / notes…" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
          </Box>

          <Box sx={{ borderTop: `1px solid ${TOKENS.border}`, pt: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary, mb: 0.5 }}>Round 1</Typography>
            <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>The first round runs now; add more later from the interview page.</Secondary>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
              <FormField label="Round name" required placeholder="Technical" value={roundName} onChange={(e) => setRoundName(e.target.value)} disabled={loading} />
              <FormField
                label="Interviewer"
                required
                select
                value={interviewerUserId}
                onChange={(e) => setInterviewerUserId(e.target.value)}
                disabled={loading}
                helperText={members.length === 0 ? 'No team members — invite someone from the Team page first.' : 'Who will take this round.'}
              >
                {members.map((m) => {
                  const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email;
                  return (
                    <MenuItem key={m.id} value={m.id}>
                      {fullName}
                      <Typography component="span" sx={{ fontSize: '0.75rem', color: '#9CA3AF', ml: 1 }}>{m.email}</Typography>
                    </MenuItem>
                  );
                })}
              </FormField>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              <FormField label="Meeting Link" required placeholder="https://meet.google.com/abc-defg-hij" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} disabled={loading} />
              <Box>
                <Box sx={LABEL_SX}>
                  <span>Schedule</span>
                  <Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>*</Box>
                </Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    value={startDateTime}
                    onChange={(val) => setStartDateTime(val)}
                    disabled={loading}
                    disablePast
                    minutesStep={15}
                    slotProps={{ textField: { fullWidth: true, size: 'small', sx: INPUT_SX } }}
                  />
                </LocalizationProvider>
              </Box>
              <FormField label="Duration" required select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))} disabled={loading}>
                {DURATIONS.map((d) => (
                  <MenuItem key={d.value} value={String(d.value)}>{d.label}</MenuItem>
                ))}
              </FormField>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
            <ActionButton variant="secondary" onClick={() => navigate('/interviews')} disabled={loading}>Cancel</ActionButton>
            <ActionButton onClick={handleSubmit} loading={loading}>Create interview</ActionButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
