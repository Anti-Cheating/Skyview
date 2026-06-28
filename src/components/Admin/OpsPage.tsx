import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip } from '@mui/material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, CardTitle, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface QueueRow {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
interface WebhookRow {
  id: string;
  company_id: string;
  company_name: string | null;
  event_type: string;
  status: string;
  http_status: number | null;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
}

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString() : '—');

function QueueCard({ q }: { q: QueueRow }) {
  return (
    <Card elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <CardTitle sx={{ color: TOKENS.textPrimary, mb: 1.5 }}>{q.name}</CardTitle>
        {([
          ['Waiting', q.waiting],
          ['Active', q.active],
          ['Failed', q.failed],
        ] as const).map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Secondary sx={{ color: TOKENS.textSecondary }}>{label}</Secondary>
            <Secondary sx={{ color: label === 'Failed' && value > 0 ? TOKENS.error : TOKENS.textPrimary, fontWeight: 600 }}>{value}</Secondary>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OpsPage() {
  const { showError } = useSnackbar();
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [failedTotal, setFailedTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AdminService.queues()
      .then((r) => setQueues(r.data?.queues ?? []))
      .catch((e: any) => showError(e?.message || 'Failed to load queues'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    AdminService.webhooks({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
        setFailedTotal(r.data?.failed_total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load webhook deliveries'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const columns = useMemo<DataTableColumn<WebhookRow>[]>(
    () => [
      { key: 'event', header: 'Event', render: (d) => <Box sx={{ color: TOKENS.textPrimary }}>{d.event_type}</Box> },
      { key: 'company', header: 'Company', hideOn: 'mobile', render: (d) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{d.company_name ?? d.company_id}</Caption> },
      { key: 'status', header: 'Status', width: 120, render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.status}</Box> },
      { key: 'http', header: 'HTTP', width: 80, align: 'right', render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.http_status ?? '—'}</Box> },
      { key: 'attempts', header: 'Attempts', width: 100, align: 'right', hideOn: 'mobile', render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.attempt_count}</Box> },
      { key: 'created', header: 'When', width: 170, hideOn: 'mobile', render: (d) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(d.created_at)}</Caption> },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Operations</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Background queues and webhook delivery health.</Secondary>
      </Box>

      {queues.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
          {queues.map((q) => (
            <QueueCard key={q.name} q={q} />
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <CardTitle sx={{ color: TOKENS.textPrimary }}>Webhook deliveries</CardTitle>
        <Chip size="small" color="error" label={`${failedTotal} failed`} />
      </Box>

      <DataTable<WebhookRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No webhook deliveries."
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
