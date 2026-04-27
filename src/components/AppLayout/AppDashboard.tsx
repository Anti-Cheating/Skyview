import { useEffect, useState } from 'react';
import { InterviewService } from '../../services/interview.service';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';

// Module-scoped cache for the dashboard counts. Lives for the lifetime
// of the SPA tab — survives navigating away from /dashboard and back,
// but is cleared by a hard reload (which is what we want — a fresh
// page load is the user signalling they want the latest).
//
// Stale-while-revalidate: if a cached value exists we render it
// immediately (no shimmer) and re-fetch in the background. The first
// dashboard visit in a session shows shimmer; every subsequent visit
// is instant. We don't bother with a TTL — the background refresh on
// every mount catches any drift within a couple hundred milliseconds.
let _countsCache: { upcoming: number; past: number } | null = null;
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  useTheme,
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  Event as EventIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { DashboardShimmer } from '../common/Shimmer';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { USER_ROLES } from '../../config/constants';
import { getUserDisplayName } from '../../utils/user.utils';
import { checkHelperHealth } from '../../services/helperBridge';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
  onClick?: () => void;
}

function StatCard({ title, value, icon, bgColor, onClick }: StatCardProps) {
  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        bgcolor: '#FFFFFF',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              borderColor: 'primary.main',
              boxShadow: '0 8px 24px rgba(76, 217, 100, 0.15)',
            }
          : {},
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: { xs: 40, md: 56 },
              height: { xs: 40, md: 56 },
              borderRadius: '12px',
              bgcolor: bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography variant="h1" sx={{ color: '#1F2937', mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: '#6B7280', fontWeight: 500 }}>
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function AppDashboard() {
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const theme = useTheme();
  const navigate = useNavigate();

  // Dedicated counts endpoint — one cheap query, no JOINs, no items.
  // Shape changed from { upcoming, past } to { all, scheduled, completed }
  // when the list page consolidated to a single status-pill model.
  // We map "upcoming" → scheduled and "past" → completed so the
  // welcome-message copy below stays meaningful.
  // Hydrate from the module cache up front so a returning visit paints
  // the previous numbers immediately. `loading` is only true on the
  // very first dashboard mount of the SPA session — subsequent visits
  // skip the shimmer entirely and the background refresh updates the
  // numbers in place if anything changed.
  const [upcomingCount, setUpcomingCount] = useState(_countsCache?.upcoming ?? 0);
  const [pastCount, setPastCount] = useState(_countsCache?.past ?? 0);
  const [loading, setLoading] = useState(_countsCache === null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      // Only flip the spinner when we have nothing to show. With cache
      // present, refresh quietly so the user doesn't see a flash of
      // shimmer over data they were just looking at.
      if (_countsCache === null) setLoading(true);
      try {
        const resp = await InterviewService.getCounts();
        if (cancelled) return;
        if (resp.success && resp.data) {
          const next = {
            upcoming: resp.data.scheduled ?? 0,
            past: resp.data.completed ?? 0,
          };
          _countsCache = next;
          setUpcomingCount(next.upcoming);
          setPastCount(next.past);
        }
      } catch {/* snackbar handles failures elsewhere */}
      finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
  // Only delay-shimmer the first cold load; warm visits never go
  // through the loading path so this is a no-op for them.
  const showShimmer = useDelayedFlag(loading, 250);

  // `helperInstalled` is a historical name kept because the dashboard
  // template UI still renders chips around it. It now reflects whether
  // the Trueyy Helper daemon is reachable on localhost:48123.
  const [helperInstalled, setHelperInstalled] = useState<boolean | null>(null);
  const [reauthBusy, setReauthBusy] = useState(false);

  const userRole = user?.role || USER_ROLES.CANDIDATE;
  const isCandidate = userRole === USER_ROLES.CANDIDATE;

  // Do NOT auto-probe the helper on dashboard mount. The daemon runs
  // under launchd socket activation — any /health request wakes it, which
  // burns resources when the user is just browsing their interview list.
  // Helper status is verified on the join page (where it actually matters)
  // or via the explicit "Reauthorize" button below.

  const handleReauthorize = async () => {
    // Helper picks up the current JWT on each /session/join; there's no
    // persistent auth to re-send. This action is kept as a health check.
    setReauthBusy(true);
    try {
      const health = await checkHelperHealth();
      if (health?.ok) {
        setHelperInstalled(true);
        showSuccess('Trueyy Helper is running.');
      } else {
        setHelperInstalled(false);
        showError('Trueyy Helper is not running. Install it or check that it started at login.');
      }
    } finally {
      setReauthBusy(false);
    }
  };

  // Shimmer only when the cache has nothing AND we've waited 250ms —
  // return-visits render instantly from cached counts.
  if (showShimmer) return <DashboardShimmer />;

  const getWelcomeTitle = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${greeting}, ${getUserDisplayName(user)}!`;
  };

  const getWelcomeMessage = () => {
    if (userRole === USER_ROLES.CANDIDATE) {
      if (upcomingCount > 0) return `You have ${upcomingCount} ${upcomingCount === 1 ? 'interview' : 'interviews'} coming up. Prepare well and good luck!`;
      if (pastCount > 0) return `You've completed ${pastCount} ${pastCount === 1 ? 'interview' : 'interviews'}. Check your past interviews or wait for new opportunities.`;
      return 'Welcome! Your interview schedule will appear here once interviews are assigned to you.';
    } else {
      if (upcomingCount > 0) return `You have ${upcomingCount} ${upcomingCount === 1 ? 'interview' : 'interviews'} scheduled with candidates.`;
      if (pastCount > 0) return `You've conducted ${pastCount} ${pastCount === 1 ? 'interview' : 'interviews'}. Review past sessions or wait for new assignments.`;
      return 'Welcome! Your interview schedule will appear here once interviews are assigned to you.';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h1" sx={{ mb: 3, color: '#1F2937' }}>
        Dashboard
      </Typography>

      {/* Welcome Banner */}
      <Box
        sx={{
          mb: 4,
          p: 3,
          borderRadius: '16px',
          border: '1px solid',
          borderColor: 'rgba(76, 217, 100, 0.3)',
          background: 'linear-gradient(135deg, rgba(76, 217, 100, 0.1) 0%, rgba(76, 217, 100, 0.05) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              bgcolor: 'rgba(76, 217, 100, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUpIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h2" sx={{ color: '#1F2937', mb: 1 }}>
              {getWelcomeTitle()}
            </Typography>
            <Typography variant="body1" sx={{ color: '#6B7280' }}>
              {getWelcomeMessage()}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Trueyy Extension status — candidates only */}
      {isCandidate && (
        <Box
          sx={{
            mb: 4,
            p: 2.5,
            borderRadius: '14px',
            border: '1px solid #E5E7EB',
            bgcolor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              bgcolor: helperInstalled ? 'rgba(76, 217, 100, 0.15)' : 'rgba(245, 158, 11, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ExtensionIcon
              sx={{
                fontSize: 22,
                color: helperInstalled ? theme.palette.primary.main : '#F59E0B',
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" sx={{ color: '#1F2937' }}>
              Trueyy Chrome Extension
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              {helperInstalled === null
                ? 'Click Reauthorize to verify the helper is installed and running.'
                : helperInstalled
                ? 'Installed and connected. You\'re ready to join an extension-type interview.'
                : 'Not detected. Install the helper, then click Reauthorize to verify.'}
            </Typography>
          </Box>
          <Button
            onClick={handleReauthorize}
            disabled={reauthBusy}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '10px',
              borderColor: '#E5E7EB',
              color: '#1F2937',
              '&:hover': { bgcolor: '#F3F4F6', borderColor: '#D1D5DB' },
              flexShrink: 0,
            }}
          >
            {reauthBusy ? 'Connecting…' : 'Reauthorize'}
          </Button>
        </Box>
      )}

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        <StatCard
          title="Upcoming Interviews"
          value={upcomingCount}
          icon={<VideoCallIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />}
          bgColor="rgba(76, 217, 100, 0.15)"
          onClick={() => navigate('/interviews')}
        />
        <StatCard
          title="Past Interviews"
          value={pastCount}
          icon={<HistoryIcon sx={{ fontSize: 28, color: '#4CAF50' }} />}
          bgColor="rgba(76, 175, 80, 0.15)"
          onClick={() => navigate('/interviews')}
        />
        <StatCard
          title="Total Interviews"
          value={upcomingCount + pastCount}
          icon={<EventIcon sx={{ fontSize: 28, color: '#FF9800' }} />}
          bgColor="rgba(255, 152, 0, 0.15)"
          onClick={() => navigate('/interviews')}
        />
      </Box>
    </Box>
  );
}
