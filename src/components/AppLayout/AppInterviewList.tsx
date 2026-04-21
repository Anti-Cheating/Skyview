import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InterviewListShimmer } from '../common/Shimmer';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  Pagination,
  Stack,
  Chip,
  Button,
  useTheme,
} from '@mui/material';
import {
  EventBusy as EventBusyIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import AppInterviewCard from './AppInterviewCard';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { USER_ROLES } from '../../config/constants';
import { useInterviewList } from '../../contexts/InterviewCacheContext';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`interview-tabpanel-${index}`}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const ITEMS_PER_PAGE = 10;

export default function AppInterviewList() {
  const { user } = useAuth();
  const { showError } = useSnackbar();
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Page-1 data comes from the app-wide cache (stale-while-revalidate).
  // Subsequent pages bypass the cache and hit the API directly — those
  // are active-use interactions, not background fetches, so showing a
  // brief loader there is acceptable.
  const upcomingCache = useInterviewList('upcoming');
  const pastCache     = useInterviewList('past');

  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [pagedUpcoming, setPagedUpcoming] = useState<InterviewSession[] | null>(null);
  const [pagedPast, setPagedPast] = useState<InterviewSession[] | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role || USER_ROLES.CANDIDATE;
  const isInterviewer = userRole === USER_ROLES.INTERVIEWER;

  // Resolved list shown for the active tab — prefer the explicit paged
  // result when the user has navigated past page 1, otherwise fall back
  // to the cached full list.
  const upcomingInterviews = upcomingPage === 1
    ? (upcomingCache.data ?? [])
    : (pagedUpcoming ?? []);
  const pastInterviews = pastPage === 1
    ? (pastCache.data ?? [])
    : (pagedPast ?? []);

  // "Has more" = we have a full page's worth of results; signals that
  // advancing pagination will likely find additional rows.
  const upcomingHasMore = upcomingPage === 1
    ? (upcomingCache.data?.length ?? 0) > ITEMS_PER_PAGE
    : (pagedUpcoming?.length ?? 0) === ITEMS_PER_PAGE;
  const pastHasMore = pastPage === 1
    ? (pastCache.data?.length ?? 0) > ITEMS_PER_PAGE
    : (pagedPast?.length ?? 0) === ITEMS_PER_PAGE;

  // `loading` is only true on the very first fetch when there is no
  // cached data at all. Returning visitors render instantly from cache.
  const loading = tabValue === 0
    ? (upcomingPage === 1 ? upcomingCache.loading : pageLoading)
    : (pastPage === 1 ? pastCache.loading : pageLoading);

  // Delay the shimmer by 250ms so sub-threshold loads (fast networks,
  // return-visits with warm cache) never flash a placeholder.
  const showShimmer = useDelayedFlag(loading, 250);

  // Fetch paged results when the user moves off page 1.
  useEffect(() => {
    const when = tabValue === 0 ? 'upcoming' : 'past';
    const page = when === 'upcoming' ? upcomingPage : pastPage;
    if (page === 1) return;
    let cancelled = false;
    (async () => {
      setPageLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const response = when === 'upcoming'
          ? await InterviewService.getUpcoming(ITEMS_PER_PAGE, offset)
          : await InterviewService.getPast(ITEMS_PER_PAGE, offset);
        if (cancelled) return;
        if (response.success) {
          const list = response.data || [];
          if (when === 'upcoming') setPagedUpcoming(list);
          else setPagedPast(list);
        } else {
          const msg = response.message || 'Failed to fetch interviews';
          setError(msg);
          showError(msg);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err.status === 401 ? 'Your session has expired. Please log in again.'
          : err.message || 'Failed to fetch interviews.';
        setError(msg);
        showError(msg);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, upcomingPage, pastPage]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Reset the paged result on the tab we're leaving so switching back
    // shows the cache-backed page-1 view first, not stale paged data.
    if (newValue === 0) {
      setUpcomingPage(1);
      setPagedPast(null);
    } else {
      setPastPage(1);
      setPagedUpcoming(null);
    }
  };

  if (error && upcomingInterviews.length === 0 && pastInterviews.length === 0) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  }

  const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, px: 3 }}>
      <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(76, 217, 100, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
        {icon}
      </Box>
      <Typography variant="h2" sx={{ color: '#1F2937', mb: 1 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>{message}</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h1" sx={{ color: '#1F2937', mb: 0.5 }}>

              Interviews
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              {userRole === USER_ROLES.CANDIDATE
                ? 'Manage and join your scheduled interviews'
                : 'Review and conduct interviews with candidates'}
            </Typography>
          </Box>
          {isInterviewer && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/interviews/new')}
              size="small"
              sx={{
                fontWeight: 600,
                borderRadius: '8px',
                px: 2,
                py: 0.75,
                bgcolor: '#4CD964',
                color: '#fff',
                boxShadow: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: '#3CB853',
                  boxShadow: '0 4px 12px rgba(76, 217, 100, 0.3)',
                },
              }}
            >
              New Interview
            </Button>
          )}
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: '#E5E7EB', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: '#6B7280', textTransform: 'none', fontWeight: 500, minHeight: 48, px: 3,
                '&.Mui-selected': { color: 'primary.main', fontWeight: 600 },
                '&:hover': { color: 'primary.main', bgcolor: 'rgba(76, 217, 100, 0.05)' },
              },
              '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: 3, borderRadius: '3px 3px 0 0' },
            }}
          >
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
                <span>Upcoming</span>
                {upcomingInterviews.length > 0 && (
                  <Chip label={upcomingInterviews.length} size="small" sx={{ height: 20, minWidth: 20, bgcolor: 'rgba(76, 217, 100, 0.2)', color: theme.palette.primary.main, fontSize: '0.688rem', fontWeight: 600, '& .MuiChip-label': { px: 0.5 } }} />
                )}
              </Box>
            } />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 18 }} />
                <span>Past</span>
                {pastInterviews.length > 0 && (
                  <Chip label={pastInterviews.length} size="small" sx={{ height: 20, minWidth: 20, bgcolor: '#F3F4F6', color: '#6B7280', fontSize: '0.688rem', fontWeight: 600, '& .MuiChip-label': { px: 0.5 } }} />
                )}
              </Box>
            } />
          </Tabs>
        </Box>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {showShimmer && upcomingInterviews.length === 0 ? (
          <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>
        ) : upcomingInterviews.length === 0 && !loading ? (
          <EmptyState
            icon={<EventBusyIcon sx={{ fontSize: 60, color: 'primary.main' }} />}
            title="No Upcoming Interviews"
            message="You don't have any scheduled interviews at the moment. Check back later or wait for new interview invitations."
          />
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
              {upcomingInterviews.map((interview) => (
                <AppInterviewCard key={interview.id} interview={interview} userRole={userRole} />
              ))}
            </Box>
            {(upcomingHasMore || upcomingPage > 1) && (
              <Stack spacing={2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
                <Pagination
                  count={upcomingHasMore ? upcomingPage + 1 : upcomingPage}
                  page={upcomingPage}
                  onChange={(_, page) => setUpcomingPage(page)}
                  color="primary"
                  shape="rounded"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: '#6B7280',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(76, 217, 100, 0.15)',
                        color: '#1F2937',
                      },
                    },
                  }}
                />
              </Stack>
            )}
          </>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {showShimmer && pastInterviews.length === 0 ? (
          <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>
        ) : pastInterviews.length === 0 && !loading ? (
          <EmptyState
            icon={<HistoryIcon sx={{ fontSize: 60, color: 'primary.main' }} />}
            title="No Past Interviews"
            message="Your completed interview history will appear here once you complete an interview."
          />
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
              {pastInterviews.map((interview) => (
                <AppInterviewCard key={interview.id} interview={interview} userRole={userRole} />
              ))}
            </Box>
            {(pastHasMore || pastPage > 1) && (
              <Stack spacing={2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
                <Pagination
                  count={pastHasMore ? pastPage + 1 : pastPage}
                  page={pastPage}
                  onChange={(_, page) => setPastPage(page)}
                  color="primary"
                  shape="rounded"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: '#6B7280',
                      fontSize: '0.875rem',
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(76, 217, 100, 0.15)',
                        color: '#1F2937',
                      },
                    },
                  }}
                />
              </Stack>
            )}
          </>
        )}
      </TabPanel>
    </Box>
  );
}
