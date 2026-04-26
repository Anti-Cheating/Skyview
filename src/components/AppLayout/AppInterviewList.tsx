/**
 * AppInterviewList — staff/candidate list view, server-driven.
 *
 * Replaces the old Upcoming/Past tabs + client-side status filter +
 * client-side search with a single unified call to
 * GET /interview-sessions. Server returns items, total, and pill
 * counts in one shot, so the page does no client-side reshaping.
 *
 * View split:
 *   - staff on >= md → table (InterviewTable + DataTable)
 *   - everywhere else (mobile staff, all candidates) → card grid
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InterviewListShimmer } from '../common/Shimmer';
import {
  Box,
  Typography,
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
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';
import AppInterviewCard from './AppInterviewCard';
import InterviewTable from './InterviewTable';
import { InterviewService, type InterviewListPill } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { USER_ROLES, isStaffRole } from '../../config/constants';
import { ActionButton } from '../common/ActionButton';
import { useDelayedFlag } from '../../hooks/useDelayedFlag';

const DEFAULT_PAGE_SIZE = 10;

const PILLS: { value: InterviewListPill; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
];

export default function AppInterviewList() {
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const theme = useTheme();
  const navigate = useNavigate();

  const userRole = user?.role || USER_ROLES.CANDIDATE;
  const isInterviewer = isStaffRole(userRole);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const useTableView = isInterviewer && !isMobile;

  // Pill defaults to "scheduled" — the typical "what's coming up" view.
  // Candidates skip the pill row entirely (volume too low) but still
  // benefit from the same server endpoint.
  const [pill, setPill] = useState<InterviewListPill>('scheduled');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [items, setItems] = useState<InterviewSession[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ all: number; scheduled: number; completed: number }>({
    all: 0,
    scheduled: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete-confirmation dialog state. Destructive action, so we always
  // confirm — even though the icon is already role-gated upstream.
  const [pendingDelete, setPendingDelete] = useState<InterviewSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 300ms search debounce — committing every keystroke to the server
  // makes the input feel laggy. Pill changes commit immediately.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the filter or search changes — otherwise
  // the user lands on a page that may not exist for the new query.
  useEffect(() => {
    setPage(1);
  }, [pill, search]);

  // Track the latest fetch so out-of-order responses don't paint stale
  // data over fresh results (user clicks a pill, then types a search,
  // then the pill response arrives late).
  const fetchSeq = useRef(0);

  useEffect(() => {
    const seq = ++fetchSeq.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await InterviewService.getSessions({
          status: pill,
          search,
          page,
          pageSize,
        });
        if (cancelled || seq !== fetchSeq.current) return;
        if (resp.success && resp.data) {
          setItems(resp.data.items);
          setTotal(resp.data.total);
          setCounts(resp.data.counts);
        } else {
          const msg = resp.message || 'Failed to fetch interviews';
          setError(msg);
          showError(msg);
        }
      } catch (err: any) {
        if (cancelled || seq !== fetchSeq.current) return;
        const msg = err.status === 401
          ? 'Your session has expired. Please log in again.'
          : err?.data?.error || err.message || 'Failed to fetch interviews.';
        setError(msg);
        showError(msg);
      } finally {
        if (!cancelled && seq === fetchSeq.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pill, search, page, pageSize]);

  const showShimmer = useDelayedFlag(loading && items.length === 0, 250);

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
        showSuccess(`"${pendingDelete.title}" cancelled`);
        setPendingDelete(null);
        // Re-fetch the current page so the row's status flips into the
        // Completed pill (server-side it's now status=CANCELLED, not
        // gone — soft-delete preserves the audit trail).
        fetchSeq.current++;
        const seq = fetchSeq.current;
        const fresh = await InterviewService.getSessions({ status: pill, search, page, pageSize });
        if (seq === fetchSeq.current && fresh.success && fresh.data) {
          setItems(fresh.data.items);
          setTotal(fresh.data.total);
          setCounts(fresh.data.counts);
        }
      } else {
        showError(resp.message || 'Failed to cancel interview');
      }
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Failed to cancel interview');
    } finally {
      setDeleting(false);
    }
  };

  const EmptyState = useMemo(() => () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, px: 3 }}>
      <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(76, 217, 100, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
        <EventBusyIcon sx={{ fontSize: 60, color: 'primary.main' }} />
      </Box>
      <Typography variant="h2" sx={{ color: '#1F2937', mb: 1 }}>
        No interviews found
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
        {pill !== 'all' || search
          ? 'Try clearing the filters or search to see more results.'
          : isInterviewer
            ? 'Schedule your first interview to get started.'
            : 'You don\'t have any interviews scheduled yet.'}
      </Typography>
    </Box>
  ), [pill, search, isInterviewer]);

  // Toolbar — staff-only. Pills with counts on the left, search input
  // on the right. Hidden on candidate side because the volume there
  // doesn't justify chrome.
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
          {PILLS.map((p) => {
            const selected = pill === p.value;
            const count = counts[p.value];
            return (
              <Chip
                key={p.value}
                label={`${p.label} (${count})`}
                onClick={() => setPill(p.value)}
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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

  if (error && items.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

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
      </Box>

      {showShimmer ? (
        <Box sx={{ py: 2 }}><InterviewListShimmer count={3} /></Box>
      ) : (
        <>
          {renderToolbar()}
          {/* Pill change = wholesale slide-up + fade on the content
              region below. Keyed only by `pill` (not `search`) so
              typing in the search box doesn't trigger a full unmount —
              search updates flow through the per-card / per-row
              animations inside, which give richer "what just changed"
              feedback. */}
          <motion.div
            key={pill}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
          {items.length === 0 ? (
            <EmptyState />
          ) : useTableView ? (
            <InterviewTable
              rows={items}
              loading={loading}
              userRole={userRole}
              onEdit={handleEditInterview}
              onDelete={handleDeleteInterview}
              emptyText="No interviews match your filters."
              pagination={{
                page,
                pageSize,
                total,
                onChange: (nextPage, nextSize) => {
                  if (nextSize !== pageSize) setPageSize(nextSize);
                  else setPage(nextPage);
                },
              }}
            />
          ) : (
            <>
              {/* Card grid with framer-motion layout animations. When the
                  status pill or search changes, items animate to their
                  new positions instead of snapping. `popLayout` mode
                  removes the exiting card from layout calculations
                  immediately so remaining cards reflow smoothly. */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5, mb: 3 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {items.map((interview) => (
                    <motion.div
                      key={interview.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{
                        layout: { duration: 0.25, ease: 'easeOut' },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2 },
                      }}
                    >
                      <AppInterviewCard
                        interview={interview}
                        userRole={userRole}
                        onEdit={handleEditInterview}
                        onDelete={handleDeleteInterview}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
              {total > pageSize && (
                <Stack spacing={2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
                  <Pagination
                    count={Math.max(1, Math.ceil(total / pageSize))}
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
          )}
          </motion.div>
        </>
      )}

      {/* Delete confirmation — only reachable when the row's Delete
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
          Cancel interview?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', color: '#4B5563' }}>
            This will cancel <strong>{pendingDelete?.title}</strong>. The candidate
            and interviewer will be notified by email. The session moves to your
            Completed list and stays there for audit. This action can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            Keep
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
            {deleting ? 'Cancelling…' : 'Cancel interview'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
