import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  MenuItem,
  Breadcrumbs,
  Link,
  RadioGroup,
  Radio,
  FormControlLabel,
} from '@mui/material';
import {
  NavigateNext as BreadcrumbIcon,
  Computer as AppIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { InterviewService } from '../../services/interview.service';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { INPUT_SX, LABEL_SX } from '../common/formTokens';
import { TOKENS } from '../../theme';
import type { InterviewType } from '../../types/interview.types';

const PROVIDERS = [
  { value: 'zoom', label: 'Zoom', disabled: false },
  { value: 'teams', label: 'Microsoft Teams', disabled: true },
  { value: 'daily', label: 'Daily.co', disabled: false },
  { value: 'google_meet', label: 'Google Meet', disabled: true },
  { value: 'other', label: 'Other', disabled: true },
];

const DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1 hour 30 minutes' },
  { value: 120, label: '2 hours' },
];

export default function CreateInterviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  // If the URL carries an :id param (route `/interviews/:id/edit`) this
  // page is in edit mode — the form prefills from the existing session
  // and Save calls PATCH instead of POST.
  const { id: editingId } = useParams<{ id: string }>();
  const isEditMode = !!editingId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [candidateFirstName, setCandidateFirstName] = useState('');
  const [candidateLastName, setCandidateLastName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [startDateTime, setStartDateTime] = useState<Dayjs | null>(
    dayjs().add(1, 'hour').startOf('hour')
  );
  const [duration, setDuration] = useState(60);
  const [interviewType, setInterviewType] = useState<InterviewType>('application');
  const [provider, setProvider] = useState('zoom');
  const [meetingLink, setMeetingLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Prefill the form from an existing session when the URL says edit.
  // We deliberately don't let the candidate's email be changed here —
  // changing participant identity after the fact is a separate concern
  // (re-invite flow) — so the email field just renders disabled below.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await InterviewService.getById(editingId);
        if (cancelled) return;
        if (!resp.success || !resp.data) {
          setError(resp.message || 'Failed to load interview');
          return;
        }
        const s = resp.data;
        setTitle(s.title || '');
        setDescription(s.description || '');
        const start = dayjs(s.scheduled_start_at);
        const end = dayjs(s.scheduled_end_at);
        setStartDateTime(start.isValid() ? start : null);
        if (start.isValid() && end.isValid()) {
          setDuration(Math.max(15, end.diff(start, 'minute')));
        }
        setInterviewType((s.interview_type as InterviewType) || 'application');
        if (s.provider) setProvider(s.provider);
        if (s.provider_metadata?.join_url) {
          setMeetingLink(String(s.provider_metadata.join_url));
        } else if ((s as any).meeting_link) {
          setMeetingLink(String((s as any).meeting_link));
        }
        const candidateParticipant = s.interview_session_participants?.find(
          (p) => p.candidate_id && p.candidate
        );
        if (candidateParticipant?.candidate) {
          setCandidateFirstName(candidateParticipant.candidate.first_name || '');
          setCandidateLastName(candidateParticipant.candidate.last_name || '');
          setCandidateEmail(candidateParticipant.candidate.email || '');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load interview');
      }
    })();
    return () => { cancelled = true; };
  }, [editingId]);

  // Auto-clear the error banner the moment the user edits any field —
  // no need for a manual dismiss button (the Alert's `onClose` X was
  // dropped for the same reason). The effect re-runs only when one of
  // the form values changes, not on unrelated state updates.
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    candidateFirstName,
    candidateLastName,
    candidateEmail,
    startDateTime,
    duration,
    interviewType,
    provider,
    meetingLink,
  ]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Interview title is required'); return; }
    if (title.trim().length > 255) { setError('Title must be 255 characters or less'); return; }
    // Candidate identity checks only apply to create — in edit mode
    // these fields are disabled and the participant row is untouched.
    if (!isEditMode) {
      if (!candidateFirstName.trim()) { setError('Candidate first name is required'); return; }
      if (!candidateLastName.trim()) { setError('Candidate last name is required'); return; }
      if (!candidateEmail.trim() || !candidateEmail.includes('@')) {
        setError('Valid candidate email is required'); return;
      }
    }
    if (!startDateTime || !startDateTime.isValid()) {
      setError('Valid start date and time are required'); return;
    }
    if (startDateTime.isBefore(dayjs())) {
      setError('Start time must be in the future'); return;
    }
    if (interviewType === 'extension') {
      if (!meetingLink.trim()) {
        setError('Meeting link is required for extension-type interviews'); return;
      }
      try {
        new URL(meetingLink.trim());
      } catch {
        setError('Meeting link must be a valid URL'); return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const startAt = startDateTime.toDate();
      const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

      // Edit vs create. In edit mode we skip participant rewrites — those
      // are out of scope here, and the server superRefine would reject
      // a PATCH that tries to change identity fields on meeting_link for
      // an application-type session.
      const basePayload = {
        title: title.trim(),
        description: description.trim() || null,
        scheduled_start_at: startAt.toISOString(),
        scheduled_end_at: endAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        interview_type: interviewType,
        provider: interviewType === 'application' ? provider : null,
        meeting_link: interviewType === 'extension' ? meetingLink.trim() : null,
      } as const;

      const response = isEditMode && editingId
        ? await InterviewService.update(editingId, basePayload)
        : await InterviewService.createInterview({
            ...basePayload,
            status: 'SCHEDULED',
            interview_session_participants: [
              {
                candidate_email: candidateEmail.trim().toLowerCase(),
                candidate_first_name: candidateFirstName.trim(),
                candidate_last_name: candidateLastName.trim(),
              },
              ...(user?.email ? [{ interviewer_email: user.email }] : []),
            ],
          });

      if (response.success) {
        setSuccess(true);
        const savedTitle = (response.data?.title || title.trim()).trim();
        if (isEditMode) {
          showSuccess(`Interview "${savedTitle}" updated`);
        } else {
          showSuccess(`Interview "${savedTitle}" scheduled`);
        }
        setTimeout(() => navigate('/interviews'), 1500);
      } else {
        const msg = response.message || (isEditMode ? 'Failed to update interview' : 'Failed to create interview');
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err.message || (isEditMode ? 'Failed to update interview. Please try again.' : 'Failed to create interview. Please try again.');
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                color: '#1F2937',
                letterSpacing: '-0.01em',
                mb: 0.5,
              }}
            >
              {isEditMode ? 'Edit Interview' : 'New Interview'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
              {isEditMode ? 'Update the interview details' : 'Schedule a meeting and invite a candidate'}
            </Typography>
          </Box>
        </Box>

        <Breadcrumbs
          separator={<BreadcrumbIcon sx={{ fontSize: 16, color: '#D1D5DB' }} />}
          sx={{ borderBottom: 1, borderColor: '#E5E7EB', pb: 1.5 }}
        >
          <Link
            component="button"
            underline="hover"
            onClick={() => navigate('/interviews')}
            sx={{
              fontSize: '0.938rem',
              fontWeight: 500,
              color: '#6B7280',
              cursor: 'pointer',
              '&:hover': { color: '#4CD964' },
            }}
          >
            Interviews
          </Link>
          <Typography sx={{ fontSize: '0.938rem', fontWeight: 600, color: '#4CD964' }}>
            New Interview
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Form Card */}
      <Box>
        <Box
          sx={{
            width: '100%',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            bgcolor: '#fff',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Success goes only to the top-right toast — no inline
                duplicate. Error stays inline too so a user filling a
                long form can scroll back to see why submit failed
                instead of relying on the auto-hiding toast alone. */}
            {error && (
              <Alert severity="error" sx={{ borderRadius: '10px' }}>
                {error}
              </Alert>
            )}

            {/* Row 1: Title + Description */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <FormField
                label="Interview Title"
                required
                placeholder="e.g. Frontend Developer - Round 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading || success}
              />
              <FormField
                label="Description"
                optional
                placeholder="Brief notes about the interview..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading || success}
              />
            </Box>

            {/* Row 2: Candidate name + email */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              <FormField
                label="Candidate First Name"
                required
                placeholder="John"
                value={candidateFirstName}
                onChange={(e) => setCandidateFirstName(e.target.value)}
                disabled={loading || success || isEditMode}
              />
              <FormField
                label="Candidate Last Name"
                required
                placeholder="Smith"
                value={candidateLastName}
                onChange={(e) => setCandidateLastName(e.target.value)}
                disabled={loading || success || isEditMode}
              />
              <FormField
                label="Candidate Email"
                required
                placeholder="candidate@example.com"
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                disabled={loading || success || isEditMode}
                helperText={isEditMode ? 'Candidate identity is fixed after creation.' : undefined}
              />
            </Box>

            {/* Interview Type Selector */}
            <Box>
              <Box sx={LABEL_SX}>
                <span>Interview Type</span>
                <Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>*</Box>
              </Box>
              <RadioGroup
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                sx={{ display: 'flex', flexDirection: 'row', gap: 2, mt: 0.5 }}
              >
                <Box
                  sx={{
                    flex: 1,
                    border: '1px solid',
                    borderColor: interviewType === 'application' ? '#4CD964' : '#E5E7EB',
                    bgcolor: interviewType === 'application' ? 'rgba(76, 217, 100, 0.08)' : '#fff',
                    borderRadius: '10px',
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => !(loading || success) && setInterviewType('application')}
                >
                  <FormControlLabel
                    value="application"
                    control={<Radio size="small" disabled={loading || success} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AppIcon sx={{ fontSize: 18, color: '#4CD964' }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                            Application
                          </Typography>
                          <Typography sx={{ fontSize: '0.688rem', color: '#6B7280' }}>
                            Candidate uses Falcon desktop app
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    border: '1px solid',
                    borderColor: interviewType === 'extension' ? '#4CD964' : '#E5E7EB',
                    bgcolor: interviewType === 'extension' ? 'rgba(76, 217, 100, 0.08)' : '#fff',
                    borderRadius: '10px',
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => !(loading || success) && setInterviewType('extension')}
                >
                  <FormControlLabel
                    value="extension"
                    control={<Radio size="small" disabled={loading || success} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ExtensionIcon sx={{ fontSize: 18, color: '#4CD964' }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                            Extension
                          </Typography>
                          <Typography sx={{ fontSize: '0.688rem', color: '#6B7280' }}>
                            Candidate uses Chrome extension
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
              </RadioGroup>
            </Box>

            {/* Row 3: Provider/Link + Schedule + Duration */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              {interviewType === 'application' ? (
                <FormField
                  label="Meeting Provider"
                  required
                  select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={loading || success}
                >
                  {PROVIDERS.map((p) => (
                    <MenuItem key={p.value} value={p.value} disabled={p.disabled}>
                      {p.label}
                      {p.disabled && (
                        <Typography component="span" sx={{ fontSize: '0.688rem', color: '#9CA3AF', ml: 1 }}>
                          Coming soon
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </FormField>
              ) : (
                <FormField
                  label="Meeting Link"
                  required
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  disabled={loading || success}
                />
              )}
              <Box>
                <Box sx={LABEL_SX}>
                  <span>Schedule</span>
                  <Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>*</Box>
                </Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    value={startDateTime}
                    onChange={(val) => setStartDateTime(val)}
                    disabled={loading || success}
                    disablePast
                    minutesStep={15}
                    slotProps={{ textField: { fullWidth: true, size: 'small', sx: INPUT_SX } }}
                  />
                </LocalizationProvider>
              </Box>
              <FormField
                label="Duration"
                required
                select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={loading || success}
              >
                {DURATIONS.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </FormField>
            </Box>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              px: { xs: 2, md: 4 }, py: 2,
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              bgcolor: '#FAFAFA',
            }}
          >
            <ActionButton
              variant="secondary"
              onClick={() => navigate('/interviews')}
              disabled={loading}
            >
              Cancel
            </ActionButton>
            <ActionButton
              onClick={handleSubmit}
              loading={loading}
              disabled={success}
            >
              {loading
                ? (isEditMode ? 'Saving...' : 'Creating...')
                : (isEditMode ? 'Save Changes' : 'Create Interview')}
            </ActionButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
