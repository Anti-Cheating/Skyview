import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface AuditRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  company_id: string | null;
  company_name: string | null;
  action: string;
  details: unknown;
  created_at: string;
}

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString() : '—');

const stringifyDetails = (d: unknown): string => {
  if (d === null || d === undefined) return '';
  try {
    return JSON.stringify(d);
  } catch {
    return String(d);
  }
};

export default function AuditPage() {
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    AdminService.audit({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load audit log'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const columns = useMemo<DataTableColumn<AuditRow>[]>(
    () => [
      {
        key: 'action',
        header: 'Action',
        width: 180,
        render: (a) => (
          <Chip
            label={a.action}
            size="small"
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: TOKENS.brandBg, color: '#047857' }}
          />
        ),
      },
      { key: 'company', header: 'Company', hideOn: 'mobile', render: (a) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{a.company_name ?? a.company_id ?? '—'}</Caption> },
      { key: 'user', header: 'User', hideOn: 'mobile', render: (a) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{a.user_name ?? a.user_id ?? '—'}</Caption> },
      { key: 'when', header: 'When', width: 170, render: (a) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(a.created_at)}</Caption> },
      {
        key: 'details',
        header: 'Details',
        render: (a) => {
          const details = stringifyDetails(a.details);
          return (
            <Tooltip title={details}>
              <Box sx={{ maxWidth: 320, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {details.length > 80 ? `${details.slice(0, 80)}…` : details || '—'}
              </Box>
            </Tooltip>
          );
        },
      },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Audit log</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Every privileged action on the platform.</Secondary>
      </Box>

      <DataTable<AuditRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No audit entries."
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
