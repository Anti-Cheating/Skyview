import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Tooltip } from '@mui/material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { CandidatesService, type CandidateListItem, type CandidateStep } from '../../services/candidates.service';

/** How a step's session status reads on the Candidates pages. */
export const STEP_STATUS: Record<string, { label: string; tag: string; dot: string; filled: boolean }> = {
  SCHEDULED: { label: 'Upcoming', tag: 'SCHEDULED', dot: '#9CA3AF', filled: false },
  ACTIVE: { label: 'In progress', tag: 'IN_PROGRESS', dot: '#2563EB', filled: true },
  COMPLETED: { label: 'Done', tag: 'COMPLETED', dot: '#059669', filled: true },
  CANCELLED: { label: 'Cancelled', tag: 'CANCELLED', dot: '#DC2626', filled: false },
};
export const stepStatus = (s: string) => STEP_STATUS[s] ?? STEP_STATUS.SCHEDULED!;
export const STEP_KIND: Record<CandidateStep['kind'], string> = { interview: 'Interview', test: 'Test', assignment: 'Assignment' };

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The step they're on: the first one not finished. */
export function currentStep(steps: CandidateStep[]): string {
  if (!steps.length) return 'No steps yet';
  const next = steps.find((s) => s.status === 'SCHEDULED' || s.status === 'ACTIVE');
  if (!next) return 'All steps done';
  return `${next.status === 'ACTIVE' ? 'Now' : 'Next'}: ${next.name} · ${fmtDay(next.at)}`;
}

/** One dot per step, joined by a line, in time order. */
export function StepDots({ steps }: { steps: CandidateStep[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }} aria-label={steps.map((s) => `${s.name}: ${stepStatus(s.status).label}`).join(', ')}>
      {steps.map((s, i) => {
        const st = stepStatus(s.status);
        return (
          <Box key={s.id} sx={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <Box sx={{ width: 18, height: 2, bgcolor: TOKENS.border }} />}
            <Tooltip title={`${s.name} · ${STEP_KIND[s.kind]} · ${st.label} · ${fmtDay(s.at)}`} arrow>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${st.dot}`, bgcolor: st.filled ? st.dot : '#FFFFFF', flexShrink: 0 }} />
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}

export default function CandidatesListPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<CandidateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    CandidatesService.list({ limit: pageSize, offset: (page - 1) * pageSize, search: debounced })
      .then((r) => { setRows(r.data?.items ?? []); setTotal(r.data?.total ?? 0); })
      .catch((e: any) => showError(e?.message || 'Failed to load candidates'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debounced]);

  const columns = useMemo<DataTableColumn<CandidateListItem>[]>(() => [
    {
      key: 'candidate', header: 'Candidate',
      render: (c) => (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>
            {`${c.first_name} ${c.last_name}`.trim() || c.email}
          </Box>
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{c.email}</Caption>
        </Box>
      ),
    },
    {
      key: 'role', header: 'Role', hideOn: 'mobile',
      render: (c) => (
        <Box sx={{ fontSize: '0.875rem', color: TOKENS.textPrimary }}>
          {[...new Set(c.steps.map((s) => s.role))].join(', ') || '—'}
        </Box>
      ),
    },
    {
      key: 'steps', header: 'Progress',
      render: (c) => (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <StepDots steps={c.steps} />
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{currentStep(c.steps)}</Caption>
        </Box>
      ),
    },
    {
      key: 'last', header: 'Last activity', width: 140, hideOn: 'mobile',
      render: (c) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{new Date(c.last_activity).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</Caption>,
    },
  ], []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Candidates</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>Everyone you're evaluating, and which step they're on.</Secondary>
        </Box>
        <SearchField placeholder="Search name or email" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>
      <DataTable<CandidateListItem>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(c) => navigate(`/candidates/${c.id}`)}
        loading={loading}
        emptyText="No candidates yet. Invite someone to a test or schedule an interview."
        pagination={{ page, pageSize, total, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </Box>
  );
}
