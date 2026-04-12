import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
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

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: '#D1D5DB' },
    '&.Mui-focused fieldset': { borderColor: '#4CD964', borderWidth: 1.5 },
  },
};

function Label({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: '0.813rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
      {children}
      {optional && (
        <Typography component="span" sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 400, ml: 0.5 }}>
          (optional)
        </Typography>
      )}
    </Typography>
  );
}

export default function CreateInterviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Interview title is required'); return; }
    if (title.trim().length > 255) { setError('Title must be 255 characters or less'); return; }
    if (!candidateFirstName.trim()) { setError('Candidate first name is required'); return; }
    if (!candidateLastName.trim()) { setError('Candidate last name is required'); return; }
    if (!candidateEmail.trim() || !candidateEmail.includes('@')) {
      setError('Valid candidate email is required'); return;
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

      const response = await InterviewService.createInterview({
        title: title.trim(),
        description: description.trim() || null,
        scheduled_start_at: startAt.toISOString(),
        scheduled_end_at: endAt.toISOString(),
        status: 'scheduled',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        interview_type: interviewType,
        provider: interviewType === 'application' ? provider : null,
        meeting_link: interviewType === 'extension' ? meetingLink.trim() : null,
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
        setTimeout(() => navigate('/interviews'), 1500);
      } else {
        setError(response.message || 'Failed to create interview');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{
                fontSize: '1.5rem',
                color: '#1F2937',
                letterSpacing: '-0.01em',
                mb: 0.5,
              }}
            >
              New Interview
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Schedule a meeting and invite a candidate
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
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {success && (
              <Alert severity="success" sx={{ borderRadius: '10px' }}>
                Interview created successfully! Redirecting...
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ borderRadius: '10px' }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Row 1: Title + Description */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <Box>
                <Label>Interview Title</Label>
                <TextField
                  placeholder="e.g. Frontend Developer - Round 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                />
              </Box>
              <Box>
                <Label optional>Description</Label>
                <TextField
                  placeholder="Brief notes about the interview..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Row 2: Candidate name + email */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
              <Box>
                <Label>Candidate First Name</Label>
                <TextField
                  placeholder="John"
                  value={candidateFirstName}
                  onChange={(e) => setCandidateFirstName(e.target.value)}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                />
              </Box>
              <Box>
                <Label>Candidate Last Name</Label>
                <TextField
                  placeholder="Smith"
                  value={candidateLastName}
                  onChange={(e) => setCandidateLastName(e.target.value)}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                />
              </Box>
              <Box>
                <Label>Candidate Email</Label>
                <TextField
                  placeholder="candidate@example.com"
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Interview Type Selector */}
            <Box>
              <Label>Interview Type</Label>
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
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
              {interviewType === 'application' ? (
                <Box>
                  <Label>Meeting Provider</Label>
                  <TextField
                    select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    fullWidth
                    disabled={loading || success}
                    size="small"
                    sx={inputSx}
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
                  </TextField>
                </Box>
              ) : (
                <Box>
                  <Label>Meeting Link</Label>
                  <TextField
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    fullWidth
                    disabled={loading || success}
                    size="small"
                    sx={inputSx}
                  />
                </Box>
              )}
              <Box>
                <Label>Schedule</Label>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    value={startDateTime}
                    onChange={(val) => setStartDateTime(val)}
                    disabled={loading || success}
                    disablePast
                    minutesStep={15}
                    slotProps={{ textField: { fullWidth: true, size: 'small', sx: inputSx } }}
                  />
                </LocalizationProvider>
              </Box>
              <Box>
                <Label>Duration</Label>
                <TextField
                  select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  fullWidth
                  disabled={loading || success}
                  size="small"
                  sx={inputSx}
                >
                  {DURATIONS.map((d) => (
                    <MenuItem key={d.value} value={d.value}>
                      {d.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              px: 4, py: 2.5,
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1.5,
              bgcolor: '#FAFAFA',
            }}
          >
            <Button
              onClick={() => navigate('/interviews')}
              disabled={loading}
              sx={{
                textTransform: 'none', color: '#6B7280', fontWeight: 600,
                borderRadius: '10px', px: 3, py: 1, fontSize: '0.875rem',
                border: '1px solid #E5E7EB',
                '&:hover': { bgcolor: '#F3F4F6' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || success}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                textTransform: 'none', fontWeight: 600, borderRadius: '10px',
                px: 4, py: 1, fontSize: '0.875rem',
                bgcolor: '#4CD964', color: '#fff', boxShadow: 'none',
                '&:hover': { bgcolor: '#3CB853', boxShadow: '0 4px 12px rgba(76, 217, 100, 0.3)' },
                '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
              }}
            >
              {loading ? 'Creating...' : 'Create Interview'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
