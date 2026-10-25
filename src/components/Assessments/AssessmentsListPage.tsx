import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, PersonAddAlt1 as PersonAddIcon } from '@mui/icons-material';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ActionButton } from '../common/ActionButton';
import { Caption, PageTitle } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { StatusTag } from '../common/StatusTag';
import { TOKENS } from '../../theme';
import type { AssessmentListItem, AssessmentMode } from '../../types/assessment.types';

export function formatDuration(mode: AssessmentMode, min: number): string {
  if (mode === 'take_home') return min % 1440 === 0 ? `${min / 1440} day${min === 1440 ? '' : 's'}` : `${Math.round(min / 60)} h`;
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

export const MODE_LABEL: Record<AssessmentMode, string> = { live: 'Aptitude', take_home: 'Assignment' };

export const STATUS_TAG = {
  draft: ['SCHEDULED', 'Draft'],
  final: ['COMPLETED', 'Live'],
  cancelled: ['CANCELLED', 'Cancelled'],
} as const;

const COLUMNS: DataTableColumn<AssessmentListItem>[] = [
  {
    key: 'title',
    header: 'Name',
    render: (a) => (
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.textPrimary }}>{a.title}</Box>
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{[a.role, formatDuration(a.mode, a.duration_min)].filter(Boolean).join(' · ')}</Caption>
      </Box>
    ),
  },
  { key: 'mode', header: 'Type', width: 120, render: (a) => <Box sx={{ color: TOKENS.textPrimary, whiteSpace: 'nowrap' }}>{MODE_LABEL[a.mode]}</Box> },
  {
    key: 'candidates', header: 'Candidates', width: 130,
    render: (a) => a.candidate_count
      ? <Box sx={{ whiteSpace: 'nowrap' }}>{a.candidate_count} <Box component="span" sx={{ color: TOKENS.textSecondary }}>· {a.submitted_count} done</Box></Box>
      : <Box sx={{ color: TOKENS.textMuted }}>—</Box>,
  },
  { key: 'status', header: 'Status', width: 110, render: (a) => <StatusTag status={STATUS_TAG[a.status][0]} label={STATUS_TAG[a.status][1]} /> },
  { key: 'invite', header: '', width: 56, render: (a) => (a.status === 'final' ? <InviteButton id={a.id} /> : null) },
];

/** A live assessment can take new candidates straight from the list. */
function InviteButton({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <Tooltip title="Invite candidates">
      <IconButton size="small" aria-label="Invite candidates" onClick={(e) => { e.stopPropagation(); navigate(`/assessments/${id}/invite`); }}
        sx={{ color: TOKENS.success, border: `1px solid ${TOKENS.border}`, borderRadius: '8px', '&:hover': { bgcolor: TOKENS.brandBg, borderColor: TOKENS.brand } }}>
        <PersonAddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

const FILTERS: Array<{ value: AssessmentMode | 'all'; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'live', label: MODE_LABEL.live }, { value: 'take_home', label: MODE_LABEL.take_home },
];

/** Finalize and cancel live on the assessment's own page; a live row can also invite from here. */
export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [items, setItems] = useState<AssessmentListItem[] | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<AssessmentMode | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    AssessmentService.list()
      .then((r) => setItems(r.data ?? []))
      .catch((e) => { showError(e?.message || 'Could not load assessments'); setItems([]); });
  }, [showError]);

  // ponytail: filtered + paged in the browser; move to the API if a company has hundreds of assessments.
  const q = search.trim().toLowerCase();
  const filtered = (items ?? []).filter((a) => (mode === 'all' || a.mode === mode) && (!q || a.title.toLowerCase().includes(q) || (a.role ?? '').toLowerCase().includes(q)));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>Assessments</PageTitle>
        <ActionButton onClick={() => navigate('/assessments/new')} startIcon={<AddIcon />}>New assessment</ActionButton>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box role="radiogroup" aria-label="Type" sx={{ display: 'flex', gap: 1, flex: 1 }}>
          {FILTERS.map((f) => {
            const on = f.value === mode;
            return (
              <Box key={f.value} component="button" type="button" role="radio" aria-checked={on} onClick={() => { setMode(f.value); setPage(1); }}
                sx={{
                  all: 'unset', cursor: 'pointer', px: 1.75, py: 0.75, borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600,
                  border: `1px solid ${on ? TOKENS.brand : TOKENS.border}`, bgcolor: on ? TOKENS.brandBg : '#fff', color: on ? '#047857' : TOKENS.textSecondary,
                  '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                }}>
                {f.label}
              </Box>
            );
          })}
        </Box>
        <SearchField placeholder="Search" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>

      <DataTable<AssessmentListItem>
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(a) => navigate(`/assessments/${a.id}`)}
        loading={items === null}
        emptyText={q || mode !== 'all' ? 'No assessments match.' : 'No assessments yet. Create one to get started.'}
        pagination={{ page, pageSize, total: filtered.length, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </Box>
  );
}
