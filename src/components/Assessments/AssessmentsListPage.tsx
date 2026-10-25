import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import { MdBlock, MdLockOutline, MdPersonAdd } from 'react-icons/md';
import { Add as AddIcon } from '@mui/icons-material';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { Caption, PageTitle, Secondary } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { useConfirm, type ConfirmOptions } from '../common/useConfirm';
import { StatusTag } from '../common/StatusTag';
import { TOKENS } from '../../theme';
import type { AssessmentListItem, AssessmentMode } from '../../types/assessment.types';

const LIVE_DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];
const TAKE_HOME_HOURS = [24, 48, 72, 168];

export function formatDuration(mode: AssessmentMode, min: number): string {
  if (mode === 'take_home') return min % 1440 === 0 ? `${min / 1440} day${min === 1440 ? '' : 's'}` : `${Math.round(min / 60)} h`;
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

export const MODE_LABEL: Record<AssessmentMode, string> = { live: 'Live', take_home: 'Take-home' };

const MODES: Array<{ value: AssessmentMode; title: string; lines: string[] }> = [
  { value: 'live', title: 'Live Assessment', lines: ['Trueyy Helper on · one sitting', 'Aptitude, up to 3 hours'] },
  { value: 'take_home', title: 'Take-Home Assessment', lines: ['Trueyy Helper off · a time window', 'Questions now, build tasks later'] },
];

function NewAssessmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [mode, setMode] = useState<AssessmentMode>('live');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [liveMin, setLiveMin] = useState(60);
  const [hours, setHours] = useState(24);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) return showError('Give the assessment a title');
    setSaving(true);
    try {
      const r = await AssessmentService.create({
        title: title.trim(),
        role: role.trim() || null,
        mode,
        duration_min: mode === 'live' ? liveMin : hours * 60,
      });
      if (r.success && r.data) navigate(`/assessments/${r.data.id}`);
      else showError(r.message || 'Could not create the assessment');
    } catch (e: any) {
      showError(e?.message || 'Could not create the assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>New assessment</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {MODES.map((m) => {
            const on = mode === m.value;
            return (
              <Box
                key={m.value}
                role="button"
                tabIndex={0}
                onClick={() => setMode(m.value)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMode(m.value)}
                sx={{
                  p: 2, borderRadius: '12px', cursor: 'pointer',
                  border: `${on ? 2 : 1}px solid ${on ? TOKENS.brand : TOKENS.border}`,
                  bgcolor: on ? TOKENS.brandBg : '#fff',
                  '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: TOKENS.textPrimary }}>{m.title}</Typography>
                {m.lines.map((l) => (
                  <Typography key={l} sx={{ fontSize: '0.78rem', color: TOKENS.textSecondary }}>{l}</Typography>
                ))}
              </Box>
            );
          })}
        </Box>
        <FormField label="Title" required placeholder="Backend L2 aptitude" value={title} onChange={(e) => setTitle(e.target.value)} />
        <FormField label="Role" optional placeholder="Backend Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
        {mode === 'live' ? (
          <FormField label="Time limit" required select value={String(liveMin)} onChange={(e) => setLiveMin(Number(e.target.value))}>
            {LIVE_DURATIONS.map((m) => <MenuItem key={m} value={String(m)}>{formatDuration('live', m)}</MenuItem>)}
          </FormField>
        ) : (
          <FormField label="Window to finish" required select value={String(hours)} onChange={(e) => setHours(Number(e.target.value))}>
            {TAKE_HOME_HOURS.map((h) => <MenuItem key={h} value={String(h)}>{formatDuration('take_home', h * 60)}</MenuItem>)}
          </FormField>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</ActionButton>
        <ActionButton onClick={create} loading={saving}>Create</ActionButton>
      </DialogActions>
    </Dialog>
  );
}

export const STATUS_TAG = {
  draft: ['SCHEDULED', 'Draft'],
  final: ['COMPLETED', 'Final'],
  cancelled: ['CANCELLED', 'Cancelled'],
} as const;

const BASE_COLUMNS: DataTableColumn<AssessmentListItem>[] = [
  {
    key: 'title',
    header: 'Assessment',
    render: (a) => (
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>{a.title}</Box>
        {a.role && <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{a.role}</Caption>}
      </Box>
    ),
  },
  { key: 'mode', header: 'Mode', width: 112, render: (a) => <Box sx={{ color: TOKENS.textPrimary, whiteSpace: 'nowrap' }}>{MODE_LABEL[a.mode]}</Box> },
  { key: 'time', header: 'Time', width: 92, hideOn: 'mobile', render: (a) => <Box sx={{ color: TOKENS.textSecondary }}>{formatDuration(a.mode, a.duration_min)}</Box> },
  { key: 'questions', header: 'Questions', width: 96, render: (a) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{a.question_count}</Box> },
  { key: 'status', header: 'Status', width: 104, render: (a) => <StatusTag status={STATUS_TAG[a.status][0]} label={STATUS_TAG[a.status][1]} /> },
  {
    key: 'updated',
    header: 'Updated',
    width: 120,
    hideOn: 'mobile',
    render: (a) => (
      <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
        {new Date(a.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
      </Caption>
    ),
  },
];

export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useSnackbar();
  const [items, setItems] = useState<AssessmentListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(() => AssessmentService.list()
    .then((r) => setItems(r.data ?? []))
    .catch((e) => { showError(e?.message || 'Could not load assessments'); setItems([]); }), [showError]);
  useEffect(() => { load(); }, [load]);

  /** Row action → confirm, call, toast, reload the list. */
  const act = useCallback(async (row: AssessmentListItem, ask: ConfirmOptions, fn: () => Promise<unknown>, ok: string) => {
    if (!(await confirm(ask))) return;
    setBusy(row.id);
    try {
      await fn();
      showSuccess(ok);
      await load();
    } catch (e: any) {
      showError(e?.message || 'Something went wrong. Please try again.');
      void load(); // e.g. finalize's check flagged questions: show the new counts
    } finally {
      setBusy(null);
    }
  }, [confirm, load, showError, showSuccess]);

  const columns = useMemo<DataTableColumn<AssessmentListItem>[]>(() => [...BASE_COLUMNS, {
    key: 'actions',
    header: '',
    width: 88,
    align: 'right',
    render: (row) => {
      if (busy === row.id) return <CircularProgress size={16} sx={{ color: TOKENS.brand }} />;
      const off = !!busy;
      const btn = (title: string, icon: React.ReactNode, onClick: () => void, disabled = false) => (
        <Tooltip title={title} key={title}>
          <span>
            <IconButton size="small" aria-label={title} disabled={off || disabled} onClick={onClick}
              sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary } }}>
              {icon}
            </IconButton>
          </span>
        </Tooltip>
      );
      const blocked = row.question_count === 0 ? 'Add questions first' : row.flagged_count ? `Fix or accept ${row.flagged_count} flagged question${row.flagged_count > 1 ? 's' : ''} first` : null;
      return (
        <Box sx={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
          {row.status === 'draft' && btn(blocked ?? 'Finalize', <MdLockOutline />, () =>
            act(row, { title: 'Finalize this assessment?', body: `The AI first checks any unchecked answer keys by solving each question again without the key; mismatches are flagged for you. Then "${row.title}" is locked and you can start inviting candidates.`, confirmLabel: 'Check and finalize' },
              () => AssessmentService.finalize(row.id), 'Assessment finalized. You can invite candidates now.'),
            !!blocked)}
          {row.status === 'final' && btn('Invite candidates', <MdPersonAdd />, () => navigate(`/assessments/${row.id}/invite`))}
          {row.status !== 'cancelled' && btn('Cancel assessment', <MdBlock />, () =>
            act(row, {
              title: 'Cancel this assessment?',
              body: row.status === 'final'
                ? `"${row.title}" will be cancelled. Pending invite links stop working, and invited candidates get an email saying it's cancelled. This can't be undone.`
                : `The draft "${row.title}" stays in your list as Cancelled and can't be edited again.`,
              confirmLabel: 'Cancel assessment', cancelLabel: 'Keep it', danger: true,
            },
              () => AssessmentService.cancel(row.id), 'Assessment cancelled'))}
        </Box>
      );
    },
  }], [act, busy, navigate]);

  // ponytail: filtered + paged in the browser; move to the API if a company has hundreds of assessments.
  const q = search.trim().toLowerCase();
  const filtered = (items ?? []).filter((a) => !q || a.title.toLowerCase().includes(q) || (a.role ?? '').toLowerCase().includes(q));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Assessments</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>Build a test by chatting with AI, then send it to candidates.</Secondary>
        </Box>
        <ActionButton onClick={() => setCreating(true)} startIcon={<AddIcon />}>New assessment</ActionButton>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <SearchField placeholder="Search assessment or role" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>

      <DataTable<AssessmentListItem>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(a) => navigate(`/assessments/${a.id}`)}
        loading={items === null}
        emptyText={q ? 'No assessments match your search.' : 'No assessments yet. Create one to get started.'}
        pagination={{ page, pageSize, total: filtered.length, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />

      {creating && <NewAssessmentDialog open onClose={() => setCreating(false)} />}
      {dialog}
    </Box>
  );
}
