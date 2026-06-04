/**
 * TenantList — SuperAdmin /admin/tenants
 *
 * Same shape as TeamPage / AppInterviewList:
 *   PageTitle ▸ search input ▸ <DataTable> (one row per tenant).
 *
 * Columns: Name · Plan · Topology (V1/V2) · Status · Usage · created · ▸
 * Click row → /admin/tenants/:id.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { PageTitle, Body, Caption, Secondary } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { TOKENS } from '../../theme';
import { AdminService, type AdminTenantSummary } from '../../services/admin.service';

const PAGE_SIZE = 20;

function StatusChip({ status }: { status: string }) {
  const color =
    status === 'active'      ? { bg: 'rgba(34,197,94,0.12)',  fg: '#15803D' } :
    status === 'suspended'   ? { bg: 'rgba(239,68,68,0.12)',  fg: '#B91C1C' } :
                               { bg: '#F3F4F6',               fg: '#4B5563' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
        borderRadius: '6px', bgcolor: color.bg, color: color.fg,
        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  );
}

function TopologyChip({ isV2 }: { isV2: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
        borderRadius: '6px',
        bgcolor: isV2 ? 'rgba(124,58,237,0.12)' : '#F3F4F6',
        color: isV2 ? '#7C3AED' : '#4B5563',
        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
      }}
    >
      {isV2 ? 'Self-hosted' : 'Trueyy-hosted'}
    </Box>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0);
  const over = used > limit;
  return (
    <Box sx={{ minWidth: 120 }}>
      <Caption sx={{ display: 'block', mb: 0.25 }}>
        {used} / {limit}
      </Caption>
      <Box sx={{
        height: 4, borderRadius: 999, bgcolor: '#F3F4F6', overflow: 'hidden',
      }}>
        <Box sx={{
          height: '100%',
          width: `${pct}%`,
          bgcolor: over ? '#EF4444' : TOKENS.brand,
        }} />
      </Box>
    </Box>
  );
}

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    AdminService.listTenants()
      .then((r) => { setTenants(r.data?.tenants ?? []); setError(null); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.slug ?? '').toLowerCase().includes(q) ||
      t.plan.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const columns: DataTableColumn<AdminTenantSummary>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (t) => <Body sx={{ fontWeight: 600 }}>{t.name}</Body>,
    },
    { key: 'plan',     header: 'Plan',     render: (t) => <Body sx={{ textTransform: 'capitalize' }}>{t.plan}</Body> },
    { key: 'topo',     header: 'Database', render: (t) => <TopologyChip isV2={t.is_v2} /> },
    { key: 'status',   header: 'Status',   render: (t) => <StatusChip status={t.status} /> },
    { key: 'usage',    header: 'Usage',    render: (t) => <UsageBar used={t.sessions_used_month} limit={t.plan_limit} /> },
    {
      key: 'created',
      header: 'Created',
      render: (t) => <Secondary>{new Date(t.created_at).toLocaleDateString()}</Secondary>,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (t) => (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${t.id}`); }}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <PageTitle sx={{ mb: 2 }}>Companies</PageTitle>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search company, plan…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(t) => t.id}
        loading={loading}
        emptyState={
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Body sx={{ color: TOKENS.textSecondary }}>
              {search ? 'No companies match that search.' : 'No companies yet.'}
            </Body>
          </Box>
        }
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filtered.length,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />
    </Box>
  );
}
