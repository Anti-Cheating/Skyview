import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ProcessService } from '../../services/process.service';
import type { ProcessListItem } from '../../types/process.types';

function StatusPill({ status }: { status: ProcessListItem['status'] }) {
  const done = status === 'COMPLETED';
  return (
    <Chip
      label={done ? 'Completed' : 'In progress'}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: done ? 'rgba(76,217,100,0.14)' : 'rgba(59,130,246,0.12)',
        color: done ? '#047857' : '#2563EB',
      }}
    />
  );
}

export default function ProcessListPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<ProcessListItem[]>([]);
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
    ProcessService.list({ page, pageSize, search: debounced })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load interviews'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debounced]);

  const columns = useMemo<DataTableColumn<ProcessListItem>[]>(
    () => [
      {
        key: 'candidate',
        header: 'Candidate',
        render: (p) => (
          <Box
            component="button"
            onClick={() => navigate(`/interviews/${p.id}`)}
            sx={{
              minWidth: 0,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              p: 0,
              cursor: 'pointer',
              '&:hover .cand-name': { color: TOKENS.brand },
            }}
          >
            <Box className="cand-name" sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>
              {`${p.candidate.first_name} ${p.candidate.last_name}`.trim() || p.candidate.email}
            </Box>
            <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
              {p.candidate.email}
            </Caption>
          </Box>
        ),
      },
      { key: 'role', header: 'Role', render: (p) => <Box sx={{ color: TOKENS.textPrimary }}>{p.role}</Box> },
      {
        key: 'rounds',
        header: 'Rounds',
        width: 110,
        render: (p) => (
          <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>
            {p.rounds_done}/{p.rounds_total}
          </Box>
        ),
      },
      { key: 'status', header: 'Status', width: 140, render: (p) => <StatusPill status={p.status} /> },
      {
        key: 'updated',
        header: 'Updated',
        width: 140,
        hideOn: 'mobile',
        render: (p) => (
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
            {new Date(p.updated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Caption>
        ),
      },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Interviews</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Each interview groups a candidate's rounds for a role.
          </Secondary>
        </Box>
        <ActionButton onClick={() => navigate('/interviews/new')} startIcon={<AddIcon />}>
          New interview
        </ActionButton>
      </Box>

      <Box sx={{ mb: 2, maxWidth: 360 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search candidate, email, or role"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: TOKENS.textSecondary }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <DataTable<ProcessListItem>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No interviews yet. Create one to get started."
        pagination={{
          page,
          pageSize,
          total,
          onChange: (p, sz) => {
            setPage(p);
            setPageSize(sz);
          },
        }}
      />
    </Box>
  );
}
