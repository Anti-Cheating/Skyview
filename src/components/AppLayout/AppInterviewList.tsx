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
  const [upcomingInterviews, setUpcomingInterviews] = useState<InterviewSession[]>([]);
  const [pastInterviews, setPastInterviews] = useState<InterviewSession[]>([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [upcomingHasMore, setUpcomingHasMore] = useState(false);
  const [pastHasMore, setPastHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role || USER_ROLES.CANDIDATE;
  const isInterviewer = userRole === USER_ROLES.INTERVIEWER;

  const fetchUpcoming = async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const response = userRole === USER_ROLES.CANDIDATE
        ? await InterviewService.getUpcomingInterviews(undefined, ITEMS_PER_PAGE, offset)
        : await InterviewService.getUpcomingInterviewsForInterviewer(undefined, ITEMS_PER_PAGE, offset);

      if (response.success) {
        const interviews = response.data || [];
        setUpcomingInterviews(interviews);
        setUpcomingHasMore(interviews.length === ITEMS_PER_PAGE);
      } else {
        const msg = response.message || 'Failed to fetch upcoming interviews';
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err.status === 401 ? 'Your session has expired. Please log in again.'
        : err.message || 'Failed to fetch upcoming interviews.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchPast = async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const response = userRole === USER_ROLES.CANDIDATE
        ? await InterviewService.getPastInterviews(undefined, ITEMS_PER_PAGE, offset)
        : await InterviewService.getPastInterviewsForInterviewer(undefined, ITEMS_PER_PAGE, offset);

      if (response.success) {
        const interviews = response.data || [];
        setPastInterviews(interviews);
        setPastHasMore(interviews.length === ITEMS_PER_PAGE);
      } else {
        const msg = response.message || 'Failed to fetch past interviews';
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err.status === 401 ? 'Your session has expired. Please log in again.'
        : err.message || 'Failed to fetch past interviews.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabValue === 0) {
      fetchUpcoming(upcomingPage);
    } else {
      fetchPast(pastPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, upcomingPage, pastPage, userRole]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) {
      setUpcomingPage(1);
      setPastInterviews([]);
    } else {
      setPastPage(1);
      setUpcomingInterviews([]);
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
      <Typography variant="h6" sx={{ color: '#1F2937', fontWeight: 600, mb: 1, fontSize: '1.25rem' }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>{message}</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, color: '#1F2937', letterSpacing: '-0.01em', mb: 0.5 }}>
              Interviews
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
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
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2,
                py: 0.75,
                fontSize: '0.8rem',
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
                color: '#6B7280', textTransform: 'none', fontWeight: 500, fontSize: '0.938rem', minHeight: 48, px: 3,
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
        {loading && upcomingInterviews.length === 0 ? (
          <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>
        ) : upcomingInterviews.length === 0 ? (
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
        {loading && pastInterviews.length === 0 ? (
          <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>
        ) : pastInterviews.length === 0 ? (
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
