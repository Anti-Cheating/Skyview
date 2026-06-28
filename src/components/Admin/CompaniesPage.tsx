import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface Company {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  plan: string | null;
  is_self_hosted: boolean;
  users: number;
  used: number;
  remaining: number;
  created_at: string;
}

const fmtDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<Company[]>([]);
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
    AdminService.listCompanies({ search: debounced, limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load companies'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debounced]);

  const columns = useMemo<DataTableColumn<Company>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (c) => (
          <Box
            component="button"
            onClick={() => navigate(`/admin/companies/${c.id}`)}
            sx={{
              minWidth: 0, textAlign: 'left', background: 'none', border: 'none', p: 0, cursor: 'pointer',
              '&:hover .co-name': { color: TOKENS.brand },
            }}
          >
            <Box className="co-name" sx={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.textPrimary }}>{c.name}</Box>
            <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
              {(c.slug ?? '').toString() || c.id} · {c.status}
            </Caption>
          </Box>
        ),
      },
      { key: 'plan', header: 'Plan', render: (c) => <Box sx={{ color: TOKENS.textPrimary }}>{c.plan ?? '—'}</Box> },
      {
        key: 'type',
        header: 'Type',
        width: 130,
        render: (c) =>
          c.is_self_hosted ? (
            <Chip
              label="Self-hosted"
              size="small"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: TOKENS.brandBg, color: '#047857' }}
            />
          ) : (
            <Chip
              label="Cloud"
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, borderColor: TOKENS.border, color: TOKENS.textSecondary }}
            />
          ),
      },
      { key: 'status', header: 'Status', width: 120, render: (c) => <Box sx={{ color: TOKENS.textSecondary }}>{c.status}</Box> },
      {
        key: 'users',
        header: 'Users',
        width: 90,
        align: 'right',
        render: (c) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{c.users}</Box>,
      },
      {
        key: 'quota',
        header: 'Used / Remaining',
        width: 150,
        align: 'right',
        hideOn: 'mobile',
        render: (c) => (
          <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>
            {c.used} / {c.remaining}
          </Box>
        ),
      },
      {
        key: 'created',
        header: 'Created',
        width: 140,
        hideOn: 'mobile',
        render: (c) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(c.created_at)}</Caption>,
      },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Companies</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>Every organisation on the platform.</Secondary>
        </Box>
      </Box>

      <Box sx={{ mb: 2, maxWidth: 360 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search companies"
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

      <DataTable<Company>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No companies found."
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
