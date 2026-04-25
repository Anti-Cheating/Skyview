import { useMemo, useState, useEffect } from 'react';
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
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
} from '@mui/material';
import {
  EventBusy as EventBusyIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import AppInterviewCard from './AppInterviewCard';
import InterviewTable from './InterviewTable';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { USER_ROLES, isStaffRole } from '../../config/constants';
import { ActionButton } from '../common/ActionButton';
import { useInterviewList } from '../../contexts/InterviewCacheContext';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';

type StatusFilter = 'ALL' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function applyFilters(
  rows: InterviewSession[],
  statusFilter: StatusFilter,
  search: string
): InterviewSession[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!q) return true;
    if (r.title?.toLowerCase().includes(q)) return true;
    const participants = r.interview_session_participants || [];
    return participants.some((p) => {
      const c = p.candidate;
      const i = p.interviewer;
      const cName = c ? `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase() : '';
      const iName = i ? `${i.first_name} ${i.last_name} ${i.email}`.toLowerCase() : '';
      return cName.includes(q) || iName.includes(q);
    });
  });
}

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

const DEFAULT_PAGE_SIZE = 10;

export default function AppInterviewList() {
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
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
  const [upcomingPageSize, setUpcomingPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pastPageSize, setPastPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagedUpcoming, setPagedUpcoming] = useState<InterviewSession[] | null>(null);
  const [pagedPast, setPagedPast] = useState<InterviewSession[] | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role || USER_ROLES.CANDIDATE;
  const isInterviewer = isStaffRole(userRole);
  // Breakpoint switch — staff get a table on desktop and cards on
  // mobile; candidates always see cards regardless of width because
  // their list is short and rich-per-row.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const useTableView = isInterviewer && !isMobile;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete-confirmation dialog state. We block clicks until the user
  // says yes (destructive action + visible to the whole company).
  const [pendingDelete, setPendingDelete] = useState<InterviewSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleEditInterview = (interview: InterviewSession) => {
    navigate(`/interviews/${interview.id}/edit`);
  };

  const handleDeleteInterview = (interview: InterviewSession) => {
    setPendingDelete(interview);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const resp = await InterviewService.remove(pendingDelete.id);
      if (resp.success) {
        showSuccess(`"${pendingDelete.title}" deleted`);
        setPendingDelete(null);
        // Force the cached list to refetch so the card disappears.
        upcomingCache.refresh();
        pastCache.refresh();
      } else {
        showError(resp.message || 'Failed to delete interview');
      }
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Failed to delete interview');
    } finally {
      setDeleting(false);
    }
  };

  // Cache is keyed by 'upcoming' / 'past' only — it's a fixed page-1
  // default-size fetch. We fall back to it only when the user is on
  // page 1 with the default size; any other (page, size) tuple
  // bypasses the cache and triggers a direct API call below.
  const upcomingUsesCache = upcomingPage === 1 && upcomingPageSize === DEFAULT_PAGE_SIZE;
  const pastUsesCache     = pastPage     === 1 && pastPageSize     === DEFAULT_PAGE_SIZE;

  const upcomingInterviews = upcomingUsesCache ? (upcomingCache.data ?? []) : (pagedUpcoming ?? []);
  const pastInterviews     = pastUsesCache     ? (pastCache.data ?? [])     : (pagedPast ?? []);

  // Filters are staff-only — candidates have a short list, no value
  // adding chips. Memoise so the table doesn't reflow on every render.
  const filteredUpcoming = useMemo(
    () => (isInterviewer ? applyFilters(upcomingInterviews, statusFilter, searchQuery) : upcomingInterviews),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcomingInterviews, statusFilter, searchQuery, isInterviewer]
  );
  const filteredPast = useMemo(
    () => (isInterviewer ? applyFilters(pastInterviews, statusFilter, searchQuery) : pastInterviews),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pastInterviews, statusFilter, searchQuery, isInterviewer]
  );

  // "Has more" = current view filled a full page, suggesting more
  // exists. Server doesn't return a total count, so this heuristic
  // drives the pagination "next" affordance.
  const upcomingHasMore = upcomingUsesCache
    ? (upcomingCache.data?.length ?? 0) >= upcomingPageSize
    : (pagedUpcoming?.length ?? 0) === upcomingPageSize;
  const pastHasMore = pastUsesCache
    ? (pastCache.data?.length ?? 0) >= pastPageSize
    : (pagedPast?.length ?? 0) === pastPageSize;

  const loading = tabValue === 0
    ? (upcomingUsesCache ? upcomingCache.loading : pageLoading)
    : (pastUsesCache     ? pastCache.loading     : pageLoading);

  // Delay the shimmer by 250ms so sub-threshold loads (fast networks,
  // return-visits with warm cache) never flash a placeholder.
  const showShimmer = useDelayedFlag(loading, 250);

  // Fetch directly whenever the active tab isn't sitting on the cached
  // (page=1, size=DEFAULT_PAGE_SIZE) tuple — i.e. anytime the user
  // changed page OR picked a non-default size. The chosen size is
  // threaded straight into the API call so the server returns the
  // requested limit. Cache is preserved for the common return-visit
  // path (open page → see 10 items instantly).
  useEffect(() => {
    const when = tabValue === 0 ? 'upcoming' : 'past';
    const page = when === 'upcoming' ? upcomingPage : pastPage;
    const size = when === 'upcoming' ? upcomingPageSize : pastPageSize;
    if (page === 1 && size === DEFAULT_PAGE_SIZE) return; // cache covers this
    let cancelled = false;
    (async () => {
      setPageLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * size;
        const response = when === 'upcoming'
          ? await InterviewService.getUpcoming(size, offset)
          : await InterviewService.getPast(size, offset);
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
  }, [tabValue, upcomingPage, pastPage, upcomingPageSize, pastPageSize]);

  // Note: no explicit mount-refresh useEffect here. `useInterviewList`
  // already fetches on mount internally, so adding our own refresh()
  // here would double-fire every open (2× per endpoint; 4× under
  // React StrictMode in dev). Tab switch still triggers a refresh in
  // handleTabChange below because the component doesn't unmount.
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Reset the paged result on the tab we're leaving so switching back
    // shows the cache-backed page-1 view first, not stale paged data.
    if (newValue === 0) {
      setUpcomingPage(1);
      setPagedPast(null);
      // Refetch the tab we're entering so switching tabs always feels
      // live instead of relying on whatever was cached at mount.
      upcomingCache.refresh();
    } else {
      setPastPage(1);
      setPagedUpcoming(null);
      pastCache.refresh();
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

  // Toolbar — staff-only. Filter pills (status) on the left, search on
  // the right. Sits above the table or card grid; collapses cleanly on
  // mobile because pills wrap and the search field is full-width.
  const renderToolbar = () => {
    if (!isInterviewer) return null;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => {
            const selected = statusFilter === f.value;
            return (
              <Chip
                key={f.value}
                label={f.label}
                onClick={() => setStatusFilter(f.value)}
                size="small"
                sx={{
                  height: 28,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selected ? 'transparent' : '#E5E7EB',
                  bgcolor: selected ? 'rgba(76, 217, 100, 0.14)' : '#FFFFFF',
                  color: selected ? '#047857' : '#374151',
                  '&:hover': {
                    bgcolor: selected ? 'rgba(76, 217, 100, 0.20)' : '#F9FAFB',
                  },
                }}
              />
            );
          })}
        </Box>
        <TextField
          size="small"
          placeholder="Search title, candidate, interviewer…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', sm: 280 },
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: '0.875rem',
              bgcolor: '#FFFFFF',
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: '#D1D5DB' },
              '&.Mui-focused fieldset': { borderColor: '#4CD964', borderWidth: 1 },
            },
          }}
        />
      </Box>
    );
  };

  // Single helper that renders the body of a tab — toolbar + table on
  // desktop staff, toolbar + card grid otherwise. DRYs the previously
  // duplicated upcoming/past sections.
  const renderInterviewView = (
    rows: InterviewSession[],
    page: number,
    setPage: (n: number) => void,
    pageSize: number,
    setPageSize: (n: number) => void,
    hasMore: boolean,
    emptyContent: React.ReactNode
  ) => {
    if (showShimmer && rows.length === 0) {
      return <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>;
    }
    const filteredEmpty = rows.length === 0 && !loading;
    // Approximated total — server-side pagination doesn't return a
    // count, so we infer it from `hasMore`. Good enough to drive the
    // page-of-pages display (N+1 when more pages exist).
    const approxTotal = hasMore
      ? page * pageSize + 1
      : (page - 1) * pageSize + rows.length;
    return (
      <>
        {renderToolbar()}
        {filteredEmpty ? (
          emptyContent
        ) : useTableView ? (
          <InterviewTable
            rows={rows}
            loading={loading}
            userRole={userRole}
            onEdit={handleEditInterview}
            onDelete={handleDeleteInterview}
            emptyText="No interviews match your filters."
            pagination={{
              page,
              pageSize,
              total: approxTotal,
              // Distinguish page change from size change — the latter
              // resets to page 1 inside DataTable, so we just adopt
              // the new size and re-fetch with the new limit.
              onChange: (nextPage, nextSize) => {
                if (nextSize !== pageSize) setPageSize(nextSize);
                else setPage(nextPage);
              },
            }}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
            {rows.map((interview) => (
              <AppInterviewCard
                key={interview.id}
                interview={interview}
                userRole={userRole}
                onEdit={handleEditInterview}
                onDelete={handleDeleteInterview}
              />
            ))}
          </Box>
        )}
        {/* Card view keeps the standalone Pagination — DataTable's
            antd footer only renders inside the table itself. */}
        {!useTableView && (hasMore || page > 1) && (
          <Stack spacing={2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
            <Pagination
              count={hasMore ? page + 1 : page}
              page={page}
              onChange={(_, p) => setPage(p)}
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
                    '&:hover': { backgroundColor: 'primary.dark' },
                  },
                  '&:hover': { backgroundColor: 'rgba(76, 217, 100, 0.15)', color: '#1F2937' },
                },
              }}
            />
          </Stack>
        )}
      </>
    );
  };

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
            <ActionButton
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/interviews/new')}
            >
              New Interview
            </ActionButton>
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
        {renderInterviewView(
          filteredUpcoming,
          upcomingPage,
          setUpcomingPage,
          upcomingPageSize,
          setUpcomingPageSize,
          upcomingHasMore,
          <EmptyState
            icon={<EventBusyIcon sx={{ fontSize: 60, color: 'primary.main' }} />}
            title="No Upcoming Interviews"
            message={
              isInterviewer && (statusFilter !== 'ALL' || searchQuery)
                ? "No interviews match your current filters. Try clearing them."
                : "You don't have any scheduled interviews at the moment. Check back later or wait for new interview invitations."
            }
          />
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {renderInterviewView(
          filteredPast,
          pastPage,
          setPastPage,
          pastPageSize,
          setPastPageSize,
          pastHasMore,
          <EmptyState
            icon={<HistoryIcon sx={{ fontSize: 60, color: 'primary.main' }} />}
            title="No Past Interviews"
            message={
              isInterviewer && (statusFilter !== 'ALL' || searchQuery)
                ? "No past interviews match your current filters."
                : "Your completed interview history will appear here once you complete an interview."
            }
          />
        )}
      </TabPanel>

      {/* Delete confirmation — only reachable when the card's Delete
          icon is visible (already role-gated), but we still ask to
          prevent accidental destructive clicks. */}
      <Dialog
        open={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>
          Delete interview?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', color: '#4B5563' }}>
            This will permanently delete <strong>{pendingDelete?.title}</strong> and
            any monitoring data associated with it. This action can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            disabled={deleting}
            variant="contained"
            color="error"
            startIcon={
              deleting ? (
                <CircularProgress size={16} thickness={5} sx={{ color: '#FFFFFF' }} />
              ) : undefined
            }
            sx={{ textTransform: 'none', boxShadow: 'none' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
