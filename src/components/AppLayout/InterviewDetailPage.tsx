import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb } from '../common/Breadcrumb';
import { ProcessService } from '../../services/process.service';
import type { ProcessDetail } from '../../types/process.types';
import {
  Box,
  Typography,
  Button,
  Avatar,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Skeleton,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  AccessTime as DurationIcon,
  PersonOutline as PersonOutlineIcon,
  EventAvailable as CreatedIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Videocam as StartIcon,
  BarChart as AnalyseIcon,
} from '@mui/icons-material';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { PostAnalysisPanel } from '../PostAnalysis';
import ActivityExplorer from '../PostAnalysis/ActivityExplorer';

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

      {session.created_at && (
        <FieldRow
          icon={<CreatedIcon sx={{ fontSize: 18 }} />}
          label="Created"
          value={
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              {formatCreatedAt(session.created_at)}
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
                color: '#FFFFFF',
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
  // Round screens live under /interviews/:processId/rounds/:roundId — read the
  // round id (a round IS a session). `id` keeps the rest of the component working.
  const { roundId, processId } = useParams<{ roundId: string; processId: string }>();
  const id = roundId;
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [proc, setProc] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // True when a completed analysis already exists (from the session payload,
  // or after a freshly-triggered run reports ready). When true the panel is
  // shown automatically and the "Analyse Interview" button is hidden.
  const [hasAnalysis, setHasAnalysis] = useState(false);
  // True only when the panel was opened by clicking Analyse — tells the
  // panel to poll for the in-flight result instead of fetching once.
  const [panelPending, setPanelPending] = useState(false);
  // Page tabs: Basic Info (interview + candidate cards) / Analysis (report).
  const [tab, setTab] = useState<'info' | 'analysis' | 'activity'>('info');
  // The analysis panel mounts (and fetches) only after the Analysis tab is
  // first opened — data loads per tab selection, not eagerly on page load.
  const [analysisMounted, setAnalysisMounted] = useState(false);
  // Last status the embedded panel reported — drives the tab's loader and
  // when to reveal the report container.
  const [panelStatus, setPanelStatus] = useState<'loading' | 'ready' | 'error' | null>(null);

  useEffect(() => {
    if (processId) ProcessService.getById(processId).then((r) => setProc(r.data ?? null)).catch(() => {});
  }, [processId]);

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
          // Analysis already ran for this session — render it straight away
          // instead of making the user click Analyse again.
          if (resp.data.has_analysis) {
            setHasAnalysis(true);
            setShowAnalysis(true);
          }
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
    // Skeleton mirroring the real layout (back link → heading + action →
    // tabs → split cards) instead of a blank page with a spinner.
    return (
      <Box sx={{ width: '100%', p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Skeleton variant="text" width={90} height={20} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Skeleton variant="text" width={220} height={42} />
            <Skeleton variant="rounded" width={88} height={24} sx={{ borderRadius: '999px' }} />
          </Box>
          <Skeleton variant="rounded" width={150} height={38} sx={{ borderRadius: '8px' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 3, borderBottom: '1px solid #E5E7EB', pb: 1 }}>
          <Skeleton variant="text" width={70} height={24} />
          <Skeleton variant="text" width={70} height={24} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch' }}>
          {[0, 1].map((card) => (
            <Box
              key={card}
              sx={{ bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', p: 3, flex: '1 1 0', minWidth: 0 }}
            >
              <Skeleton variant="text" width={130} height={16} sx={{ mb: 2.5 }} />
              {[0, 1, 2, 3].map((row) => (
                <Box key={row} sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'flex-start' }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width={80} height={14} />
                    <Skeleton variant="text" width="55%" height={22} />
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
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

  const handleAnalyse = async () => {
    // Reveal the inline panel and keep the button loader on. The embedded
    // PostAnalysisPanel polls for the result and reports back via
    // onStatusChange, which flips the button loader off once it's ready.
    setAnalysing(true);
    setPanelPending(true);
    setShowAnalysis(true);
    try {
      const res = await InterviewService.triggerPostAnalysis(session.id);
      if (!res.success) {
        showError(res.message || 'Failed to start analysis');
        setAnalysing(false);
        setPanelPending(false);
        setShowAnalysis(false);
      }
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { error?: string } };
      showError(e?.data?.error || e?.message || 'Failed to start analysis');
      setAnalysing(false);
      setPanelPending(false);
      setShowAnalysis(false);
    }
  };
  return (
    // Fills the AppLayout main area; back-link + heading + tabs stay pinned
    // and only the tab content below scrolls.
    <Box
      sx={{
        width: '100%',
        height: '100%',
        p: { xs: 2, md: 3 },
        pb: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header — title on the left, session actions on the right (the old
          standalone action bar card is gone). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {session.title || 'Untitled Interview'}
            </Typography>
          </Box>
          {/* Breadcrumb sits below the title */}
          <Box sx={{ mt: 0.75 }}>
            <Breadcrumb
              items={[
                { label: 'Interviews', to: '/interviews' },
                {
                  label: proc ? proc.role : 'Interview',
                  to: `/interviews/${processId}`,
                },
                {
                  label: (() => {
                    const r = proc?.rounds.find((x) => x.id === id);
                    return r?.round_name ?? 'Round';
                  })(),
                },
              ]}
            />
          </Box>
        </Box>

        {/* Disabled Start is hidden — in the heading it would just be
            noise; the status badge already says the session ended. */}
        {canStart && (
          <Button
            variant="contained"
            onClick={() => navigate(`/interviews/${processId}/rounds/${session.id}/monitor`)}
            startIcon={<StartIcon sx={{ fontSize: 18 }} />}
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
              textTransform: 'none',
              px: 2.5,
              py: 1,
              borderRadius: '8px',
              boxShadow: 'none',
              flexShrink: 0,
              bgcolor: '#4CD964',
              color: '#FFFFFF',
              '&:hover': { bgcolor: '#3CC954', boxShadow: 'none' },
            }}
          >
            Start Interview
          </Button>
        )}
      </Box>

      {/* Tabs — content loads per selection */}
      <Tabs
        value={tab}
        onChange={(_, v: 'info' | 'analysis' | 'activity') => {
          setTab(v);
          if (v === 'analysis') setAnalysisMounted(true);
        }}
        sx={{
          borderBottom: '1px solid #E5E7EB',
          minHeight: 40,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 40,
            color: '#6B7280',
          },
          '& .Mui-selected': { color: '#111827 !important' },
          '& .MuiTabs-indicator': { bgcolor: '#4CD964', height: 2.5, borderRadius: '2px 2px 0 0' },
        }}
      >
        <Tab value="info" label="Basic Info" disableRipple />
        <Tab value="analysis" label="Analysis" disableRipple />
        <Tab value="activity" label="Activity Explorer" disableRipple />
      </Tabs>

      {/* Scrollable tab content — everything above stays pinned */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          pb: 3,
        }}
      >

      {/* ── Tab: Basic Info ── */}
      {tab === 'info' && (
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
      )}

      {/* ── Tab: Analysis ── */}
      {/* No analysis yet: the Analyse button sits where Copy Transcript /
          Export PDF live once the report exists (top-right of the panel). */}
      {tab === 'analysis' && !hasAnalysis && (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={!canAnalyse}
              onClick={() => void handleAnalyse()}
              startIcon={
                analysing ? (
                  <CircularProgress size={18} sx={{ color: '#FFFFFF' }} />
                ) : (
                  <AnalyseIcon sx={{ fontSize: 18 }} />
                )
              }
              sx={{
                bgcolor: '#4CD964',
                color: '#FFFFFF',
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
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <AnalyseIcon sx={{ fontSize: 48, color: '#E5E7EB', mb: 1 }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
              {analysing
                ? 'Analysis is running — this may take a moment.'
                : isCompleted
                  ? 'No analysis generated yet. Click "Analyse Interview" to run it.'
                  : 'Analysis becomes available once the interview is completed.'}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Skeleton while a stored analysis is being fetched for the tab —
          mirrors the report layout (actions → hero → meta → gauge +
          breakdown → summary) so content settles without a jump. */}
      {tab === 'analysis' && hasAnalysis && panelStatus !== 'ready' && panelStatus !== 'error' && (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Skeleton variant="rounded" width={140} height={32} sx={{ borderRadius: '6px' }} />
            <Skeleton variant="rounded" width={110} height={32} sx={{ borderRadius: '6px' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
            <Skeleton variant="circular" width={60} height={60} />
            <Box>
              <Skeleton variant="text" width={190} height={32} />
              <Skeleton variant="text" width={150} height={16} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 7, mt: 2.5, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton variant="text" width={72} height={13} />
                <Skeleton variant="text" width={110} height={20} />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 6, mt: 4, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Skeleton variant="text" width={110} height={24} />
              <Skeleton variant="rounded" width={260} height={140} sx={{ borderRadius: '12px' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 260 }}>
              <Skeleton variant="text" width={140} height={24} sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <Box key={i}>
                    <Skeleton variant="text" width={90} height={16} />
                    <Skeleton variant="rounded" height={6} sx={{ borderRadius: '999px', mt: 1 }} />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Skeleton variant="text" width={170} height={26} sx={{ mt: 4 }} />
          <Skeleton variant="text" height={18} />
          <Skeleton variant="text" height={18} />
          <Skeleton variant="text" width="65%" height={18} />
        </Box>
      )}

      {/* Report container — kept mounted after first load so switching
          tabs doesn't refetch; hidden via display when on Basic Info. */}
      <Box
        sx={{
          display:
            tab === 'analysis' && (panelStatus === 'ready' || panelStatus === 'error')
              ? 'block'
              : 'none',
          bgcolor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          p: { xs: 2, md: 3 },
        }}
      >
        {analysisMounted && showAnalysis && (
          <PostAnalysisPanel
            sessionId={session.id}
            pending={panelPending}
            embedded
            onStatusChange={(status) => {
              setPanelStatus(status);
              if (status === 'ready' || status === 'error') setAnalysing(false);
              // A freshly-triggered run just finished — retire the button.
              if (status === 'ready') setHasAnalysis(true);
            }}
          />
        )}
      </Box>

      {/* ── Tab: Activity Explorer (post-interview monitoring replay) ──────── */}
      <Box
        sx={{
          display: tab === 'activity' ? 'block' : 'none',
          bgcolor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          p: { xs: 2, md: 3 },
        }}
      >
        <ActivityExplorer
          sessionId={session.id}
          participantId={session.interview_session_participants?.find((p: any) => p.candidate_id)?.id}
        />
      </Box>

      </Box>{/* /scrollable tab content */}
    </Box>
  );
}
