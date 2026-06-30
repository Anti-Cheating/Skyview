import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface ContactRow {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  type: string | null;
  message: string;
  created_at: string;
}

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString() : '—');

export default function ContactQueriesPage() {
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    AdminService.contactQueries({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load contact queries'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const columns = useMemo<DataTableColumn<ContactRow>[]>(
    () => [
      { key: 'name', header: 'Name', render: (q) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{q.name ?? '—'}</Box> },
      { key: 'email', header: 'Email', render: (q) => <Box sx={{ color: TOKENS.textSecondary }}>{q.email}</Box> },
      { key: 'company', header: 'Company', hideOn: 'mobile', render: (q) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{q.company ?? '—'}</Caption> },
      {
        key: 'type',
        header: 'Type',
        width: 130,
        render: (q) =>
          q.type ? (
            <Chip label={q.type} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: TOKENS.brandBg, color: '#047857' }} />
          ) : (
            <Box sx={{ color: TOKENS.textMuted }}>—</Box>
          ),
      },
      {
        key: 'message',
        header: 'Message',
        render: (q) => (
          <Tooltip title={q.message}>
            <Box sx={{ maxWidth: 320, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.message}
            </Box>
          </Tooltip>
        ),
      },
      { key: 'when', header: 'When', width: 170, hideOn: 'mobile', render: (q) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(q.created_at)}</Caption> },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Contact queries</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Inbound messages from the marketing site.</Secondary>
      </Box>

      <DataTable<ContactRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No contact queries."
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
