import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Divider, IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { MdAdd, MdAddTask } from 'react-icons/md';
import { AssessmentService } from '../../services/assessment.service';
import { TOKENS } from '../../theme';
import type { AssessmentListItem } from '../../types/assessment.types';
import { formatDuration } from './AssessmentsListPage';

type Candidate = { email: string; first_name: string | null; last_name: string | null };

/** Invite page of `assessmentId`, with this candidate already in the list. */
export function inviteUrl(assessmentId: string, c: Candidate) {
  const q = new URLSearchParams({ email: c.email, first: c.first_name ?? '', last: c.last_name ?? '' });
  return `/assessments/${assessmentId}/invite?${q.toString()}`;
}

/**
 * "Assign take-home": pick one of the company's finalized Take-Home
 * assessments, then land on its Invite page with the candidate filled in.
 */
export function AssignTakeHome({ candidate, excludeId, variant = 'icon', onDone }: { candidate: Candidate; excludeId: string; variant?: 'icon' | 'button' | 'item'; onDone?: () => void }) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [options, setOptions] = useState<AssessmentListItem[] | null>(null);

  useEffect(() => {
    if (!anchor || options) return;
    AssessmentService.list()
      .then((r) => setOptions((r.data ?? []).filter((a) => a.mode === 'take_home' && a.status === 'final' && a.id !== excludeId)))
      .catch(() => setOptions([]));
  }, [anchor, excludeId, options]);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); setAnchor(e.currentTarget); };

  return (
    <>
      {variant === 'item' ? (
        <MenuItem onClick={openMenu}>Send an assignment</MenuItem>
      ) : variant === 'icon' ? (
        <Tooltip title="Send an assignment">
          <IconButton size="small" aria-label="Send an assignment" onClick={openMenu} sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.success } }}>
            <MdAddTask />
          </IconButton>
        </Tooltip>
      ) : (
        // Header style: a bordered icon, like the other actions next to it.
        <Tooltip title="Send an assignment">
          <IconButton aria-label="Send an assignment" onClick={openMenu}
            sx={{ border: `1px solid ${TOKENS.border}`, borderRadius: '10px', bgcolor: '#fff', color: TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary, bgcolor: TOKENS.bg } }}>
            <MdAddTask />
          </IconButton>
        </Tooltip>
      )}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => { setAnchor(null); onDone?.(); }} onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: 280, mt: 0.5 } }}>
        <Box sx={{ px: 2, pt: 1, pb: 0.5, fontSize: '0.75rem', fontWeight: 600, color: TOKENS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Send an assignment
        </Box>
        {!options && <Box sx={{ px: 2, py: 1.5 }}><CircularProgress size={16} sx={{ color: TOKENS.brand }} /></Box>}
        {options?.map((a) => (
          <MenuItem key={a.id} onClick={() => navigate(inviteUrl(a.id, candidate))}>
            <ListItemText primary={a.title} secondary={`${formatDuration('take_home', a.duration_min)} window · ${a.question_count} question${a.question_count === 1 ? '' : 's'}`}
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }} secondaryTypographyProps={{ fontSize: '0.75rem' }} />
          </MenuItem>
        ))}
        {options && options.length === 0 && (
          <Box sx={{ px: 2, py: 1, fontSize: '0.8rem', color: TOKENS.textSecondary }}>No live assignments yet.</Box>
        )}
        {options && <Divider sx={{ my: 0.5 }} />}
        {options && (
          // A new one opens the New assessment form with Assignment picked.
          <MenuItem onClick={() => navigate('/assessments/new?type=take_home')} sx={{ color: TOKENS.success, fontWeight: 600, fontSize: '0.875rem', gap: 1 }}>
            <MdAdd /> Create a new assignment
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
