import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Button,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Schedule as ScheduleIcon,
  AccessTime as DurationIcon,
  PersonOutline as PersonOutlineIcon,
  Category as TypeIcon,
  Link as LinkIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Videocam as StartIcon,
  BarChart as AnalyseIcon,
} from '@mui/icons-material';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { useSnackbar } from '../../contexts/SnackbarContext';

function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === 'COMPLETED';
  const isActive = status === 'ACTIVE';
  const isCancelled = status === 'CANCELLED';
  const color = isCompleted ? '#047857' : isActive ? '#1D4ED8' : isCancelled ? '#DC2626' : '#374151';
  const bg = isCompleted ? 'rgba(4,120,87,0.1)' : isActive ? 'rgba(29,78,216,0.1)' : isCancelled ? 'rgba(220,38,38,0.1)' : '#F3F4F6';
  const border = isCompleted
    ? 'rgba(4,120,87,0.25)'
    : isActive
    ? 'rgba(29,78,216,0.25)'
    : isCancelled
    ? 'rgba(220,38,38,0.25)'
    : '#E5E7EB';

  const label =
    status === 'COMPLETED'
      ? 'Completed'
      : status === 'ACTIVE'
      ? 'Active'
      : status === 'CANCELLED'
      ? 'Cancelled'
      : status === 'SCHEDULED'
      ? 'Scheduled'
      : status;

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontSize: '0.75rem',
        height: 22,
        bgcolor: bg,
        color,
        fontWeight: 600,
        border: '1px solid',
        borderColor: border,
        borderRadius: '6px',
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}

function FieldRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
      <Box sx={{ color: '#4CD964', mt: 0.25, flexShrink: 0, fontSize: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: '#9CA3AF',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            mb: 0.375,
          }}
        >
          {label}
        </Typography>
        {value}
      </Box>
    </Box>
  );
}

function InterviewCard({ session }: { session: InterviewSession }) {
  const scheduled = formatDateTime(session.scheduled_start_at);
  const interviewerParticipant = session.interview_session_participants?.find(
    (p) => p.interviewer_id && p.interviewer
  );
  const interviewer = interviewerParticipant?.interviewer;
  const meetingLink = session.provider_metadata?.join_url || session.provider_metadata?.start_url;
  const typeLabel =
    session.interview_type === 'extension'
      ? 'Chrome Extension'
      : session.interview_type === 'application'
      ? 'Application'
      : session.interview_type ?? '—';
  const providerLabel = session.provider ? `· ${session.provider.replace('_', ' ')}` : '';

  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        p: 3,
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: '#9CA3AF',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          mb: 2.5,
        }}
      >
        Interview Details
      </Typography>

      <FieldRow
        icon={<ScheduleIcon sx={{ fontSize: 18 }} />}
        label="Scheduled"
        value={
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              {scheduled.date}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: 0.25 }}>
              {scheduled.time}
            </Typography>
          </Box>
        }
      />

      {session.duration_minutes && (
        <FieldRow
          icon={<DurationIcon sx={{ fontSize: 18 }} />}
          label="Duration"
          value={
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              {session.duration_minutes} min
            </Typography>
          }
        />
      )}

      {interviewer && (
        <FieldRow
          icon={<PersonOutlineIcon sx={{ fontSize: 18 }} />}
          label="Interviewer"
          value={
            <Box>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
                {`${interviewer.first_name} ${interviewer.last_name}`.trim()}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', mt: 0.25 }}>
                {interviewer.email}
              </Typography>
            </Box>
          }
        />
      )}

      {session.interview_type && (
        <FieldRow
          icon={<TypeIcon sx={{ fontSize: 18 }} />}
          label="Type"
          value={
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              {typeLabel}
              {providerLabel && (
                <Box component="span" sx={{ color: '#6B7280', fontWeight: 400 }}>
                  {' '}
                  {providerLabel}
                </Box>
              )}
            </Typography>
          }
        />
      )}

      {meetingLink && (
        <FieldRow
          icon={<LinkIcon sx={{ fontSize: 18 }} />}
          label="Meeting Link"
          value={
            <Typography
              component="a"
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: '0.875rem',
                color: '#4CD964',
                fontWeight: 500,
                textDecoration: 'none',
                wordBreak: 'break-all',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {meetingLink}
            </Typography>
          }
        />
      )}
    </Box>
  );
}

function CandidateCard({ session }: { session: InterviewSession }) {
  const candidateParticipant = session.interview_session_participants?.find(
    (p) => p.candidate_id && p.candidate
  );
  const candidate = candidateParticipant?.candidate;
  const companyName = session.company?.name;

  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        p: 3,
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: '#9CA3AF',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          mb: 2.5,
        }}
      >
        Candidate
      </Typography>

      {candidate ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: '#4CD964',
                color: '#065F46',
                fontSize: '1.125rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {getInitials(candidate.first_name, candidate.last_name)}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                {`${candidate.first_name} ${candidate.last_name}`.trim()}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>Candidate</Typography>
            </Box>
          </Box>

          <FieldRow
            icon={<EmailIcon sx={{ fontSize: 18 }} />}
            label="Email"
            value={
              <Typography sx={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500, wordBreak: 'break-all' }}>
                {candidate.email}
              </Typography>
            }
          />

          <FieldRow
            icon={<PersonIcon sx={{ fontSize: 18 }} />}
            label="Name"
            value={
              <Typography sx={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                {`${candidate.first_name} ${candidate.last_name}`.trim()}
              </Typography>
            }
          />

          {companyName && (
            <FieldRow
              icon={<BusinessIcon sx={{ fontSize: 18 }} />}
              label="Company"
              value={
                <Typography sx={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                  {companyName}
                </Typography>
              }
            />
          )}
        </>
      ) : (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 48, color: '#E5E7EB', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>No candidate assigned</Typography>
        </Box>
      )}
    </Box>
  );
}

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await InterviewService.getById(id);
        if (cancelled) return;
        if (resp.success && resp.data) {
          setSession(resp.data);
        } else {
          setError(resp.message || 'Failed to load interview');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.data?.error || err?.message || 'Failed to load interview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: '#4CD964' }} />
      </Box>
    );
  }

  if (error || !session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Interview not found'}</Alert>
      </Box>
    );
  }

  const isCompleted = session.status === 'COMPLETED';
  const canStart = !isCompleted;
  const canAnalyse = isCompleted && !analysing;
  const shortId = session.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  const handleAnalyse = async () => {
    setAnalysing(true);
    try {
      const res = await InterviewService.triggerPostAnalysis(session.id);
      if (!res.success) {
        showError(res.message || 'Failed to start analysis');
        return;
      }
      navigate(`/interviews/${session.id}/analysis?pending=1`);
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { error?: string } };
      showError(e?.data?.error || e?.message || 'Failed to start analysis');
    } finally {
      setAnalysing(false);
    }
  };
  const createdLabel = session.created_at ? formatCreatedAt(session.created_at) : null;

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back nav */}
      <Box
        component={Link}
        to="/interviews"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: '#6B7280',
          textDecoration: 'none',
          fontSize: '0.875rem',
          width: 'fit-content',
          '&:hover': { color: '#374151' },
        }}
      >
        <BackIcon sx={{ fontSize: 18 }} />
        Interviews
      </Box>

      {/* Header */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {session.title || 'Untitled Interview'}
          </Typography>
          <StatusBadge status={session.status} />
        </Box>
        {(createdLabel || shortId) && (
          <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', mt: 0.5 }}>
            {createdLabel ? `Created ${createdLabel}` : ''}
            {createdLabel && shortId ? ' · ' : ''}
            {shortId ? `ID #${shortId}` : ''}
          </Typography>
        )}
      </Box>

      {/* Split cards */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
        }}
      >
        <InterviewCard session={session} />
        <CandidateCard session={session} />
      </Box>

      {/* Action bar */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          p: 3,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
        }}
      >
        <Button
          variant={canStart ? 'contained' : 'text'}
          disabled={!canStart}
          onClick={() => navigate(`/interviews/${session.id}/monitor`)}
          startIcon={<StartIcon sx={{ fontSize: 18 }} />}
          sx={{
            fontWeight: 700,
            fontSize: '0.875rem',
            textTransform: 'none',
            px: 2.5,
            py: 1,
            borderRadius: '8px',
            boxShadow: 'none',
            ...(canStart
              ? {
                  bgcolor: '#4CD964',
                  color: '#065F46',
                  '&:hover': { bgcolor: '#3CC954', boxShadow: 'none' },
                }
              : {
                  color: '#9CA3AF',
                  '&:hover': { bgcolor: 'transparent' },
                }),
            '&.Mui-disabled': { bgcolor: '#F3F4F6', color: '#9CA3AF' },
          }}
        >
          Start Interview
        </Button>
        <Button
          variant="contained"
          disabled={!canAnalyse}
          onClick={() => void handleAnalyse()}
          startIcon={
            analysing ? (
              <CircularProgress size={18} sx={{ color: '#065F46' }} />
            ) : (
              <AnalyseIcon sx={{ fontSize: 18 }} />
            )
          }
          sx={{
            bgcolor: '#4CD964',
            color: '#065F46',
            fontWeight: 700,
            fontSize: '0.875rem',
            textTransform: 'none',
            borderRadius: '8px',
            boxShadow: 'none',
            px: 2.5,
            py: 1,
            '&:hover': { bgcolor: '#3CC954', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#F3F4F6', color: '#9CA3AF' },
          }}
        >
          Analyse Interview
        </Button>
      </Box>
    </Box>
  );
}
