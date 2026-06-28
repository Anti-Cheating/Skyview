import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, CardTitle, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface Summary {
  total: number;
  by_plan: Record<string, number>;
  by_status: Record<string, number>;
  self_hosted: number;
  mrr_paise: number;
  lifetime_revenue_paise: number;
}
interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  company_id: string;
  company_name: string | null;
}

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleDateString() : '—');
const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function StatCard({ label, value, icon, bgColor }: { label: string; value: ReactNode; icon: ReactNode; bgColor: string }) {
  return (
    <Card elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 }, borderRadius: '12px', bgcolor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
        </Box>
        <Typography component="p" sx={{ color: TOKENS.textPrimary, mb: 0.5, fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</Typography>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data ?? {});
  return (
    <Card elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <CardTitle sx={{ color: TOKENS.textPrimary, mb: 2 }}>{title}</CardTitle>
        {entries.length === 0 ? (
          <Caption sx={{ color: TOKENS.textMuted }}>No data</Caption>
        ) : (
          entries.map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${TOKENS.borderLight}` }}>
              <Secondary sx={{ color: TOKENS.textSecondary }}>{k}</Secondary>
              <Secondary sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{v}</Secondary>
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const { showError } = useSnackbar();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AdminService.billingSummary()
      .then((r) => setSummary((r.data as Summary) ?? null))
      .catch((e: any) => showError(e?.message || 'Failed to load billing summary'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    AdminService.payments({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setRows(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load payments'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const columns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      { key: 'company', header: 'Company', render: (p) => <Box sx={{ color: TOKENS.textPrimary }}>{p.company_name ?? p.company_id}</Box> },
      { key: 'amount', header: 'Amount', width: 130, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{rupees(p.amount)}</Box> },
      { key: 'currency', header: 'Currency', width: 100, hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.currency}</Box> },
      { key: 'status', header: 'Status', width: 120, render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.status}</Box> },
      { key: 'paid', header: 'Paid', width: 130, hideOn: 'mobile', render: (p) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(p.paid_at)}</Caption> },
      { key: 'created', header: 'Created', width: 130, hideOn: 'mobile', render: (p) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(p.created_at)}</Caption> },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Billing</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Revenue and payments across the platform.</Secondary>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <StatCard label="Total subscriptions" value={summary?.total ?? 0} icon={<CreditCardIcon sx={{ fontSize: 24, color: '#3B82F6' }} />} bgColor="rgba(59, 130, 246, 0.12)" />
        <StatCard label="MRR" value={rupees(summary?.mrr_paise ?? 0)} icon={<AttachMoneyIcon sx={{ fontSize: 24, color: TOKENS.success }} />} bgColor="rgba(5, 150, 105, 0.12)" />
        <StatCard label="Lifetime revenue" value={rupees(summary?.lifetime_revenue_paise ?? 0)} icon={<TrendingUpIcon sx={{ fontSize: 24, color: TOKENS.success }} />} bgColor="rgba(5, 150, 105, 0.12)" />
        <StatCard label="Self-hosted" value={summary?.self_hosted ?? 0} icon={<StorageIcon sx={{ fontSize: 24, color: '#6B7280' }} />} bgColor="rgba(107, 114, 128, 0.12)" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 4 }}>
        <BreakdownCard title="By plan" data={summary?.by_plan ?? {}} />
        <BreakdownCard title="By status" data={summary?.by_status ?? {}} />
      </Box>

      <DataTable<PaymentRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No payments yet."
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
