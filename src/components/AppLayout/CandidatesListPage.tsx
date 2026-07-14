import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { TOKENS } from '../../theme';
import { Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { CandidatesService, type CandidateListItem } from '../../services/candidates.service';

export default function CandidatesListPage({ embedded = false }: { embedded?: boolean } = {}) {
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
        <Box
          component="button"
          onClick={() => navigate(`/candidates/${c.id}`)}
          sx={{ minWidth: 0, textAlign: 'left', background: 'none', border: 'none', p: 0, cursor: 'pointer', '&:hover .cand-name': { color: TOKENS.brand } }}
        >
          <Box className="cand-name" sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>
            {`${c.first_name} ${c.last_name}`.trim() || c.email}
          </Box>
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{c.email}</Caption>
        </Box>
      ),
    },
    { key: 'interviews', header: 'Interviews', width: 110, render: (c) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{c.interviews_count}</Box> },
    { key: 'rounds', header: 'Rounds', width: 100, render: (c) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{c.rounds_count}</Box> },
    {
      key: 'last', header: 'Last activity', width: 150, hideOn: 'mobile',
      render: (c) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{new Date(c.last_activity).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</Caption>,
    },
  ], [navigate]);

  return (
    <Box sx={{ p: embedded ? 0 : { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <SearchField placeholder="Search name or email" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>
      <DataTable<CandidateListItem>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No candidates yet."
        pagination={{ page, pageSize, total, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </Box>
  );
}
