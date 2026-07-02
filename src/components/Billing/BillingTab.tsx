import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Chip, IconButton, Tooltip,
} from '@mui/material';
import { FileDownloadOutlined } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary, Caption, Overline, SubHeading } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { BillingService } from '../../services/billing.service';
import type { Subscription, SubscriptionStatus, Invoice } from '../../types/billing.types';

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; bg: string; fg: string; dot: string }> = {
  trial:     { label: 'Free Trial',    bg: 'rgba(59, 130, 246, 0.12)', fg: '#2563EB', dot: '#3B82F6' },
  created:   { label: 'Pending',       bg: 'rgba(250, 204, 21, 0.15)', fg: '#B45309', dot: '#FACC15' },
  active:    { label: 'Active',        bg: 'rgba(76, 217, 100, 0.14)', fg: '#047857', dot: TOKENS.brand },
  charged:   { label: 'Active',        bg: 'rgba(76, 217, 100, 0.14)', fg: '#047857', dot: TOKENS.brand },
  halted:    { label: 'Payment Issue', bg: 'rgba(239, 68, 68, 0.12)',  fg: '#DC2626', dot: TOKENS.error },
  cancelled: { label: 'Cancelled',     bg: '#F3F4F6',                  fg: '#4B5563', dot: '#9CA3AF' },
  completed: { label: 'Expired',       bg: '#F3F4F6',                  fg: '#4B5563', dot: '#9CA3AF' },
};

function StatusPill({ status }: { status: SubscriptionStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, height: 22,
        borderRadius: '6px', bgcolor: c.bg, color: c.fg, fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
      {c.label}
    </Box>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(paise: number, currency: string, interval: string | null = 'monthly'): string {
  if (paise === 0) return 'Free';
  const amount = paise / 100;
  const period = interval === 'yearly' ? 'year' : 'month';
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}/${period}`;
  return `${currency} ${amount}/${period}`;
}

interface Props {
  subscription: Subscription | null;
  loading: boolean;
  onRefresh: () => void;
}

export function BillingTab({ subscription, loading, onRefresh }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(10);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingInvoices(true);
    BillingService.listInvoices(invoicesPage, invoicesPageSize)
      .then(({ items, total }) => { setInvoices(items); setInvoicesTotal(total); })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [subscription, invoicesPage, invoicesPageSize]);

  // Server renders a branded PDF (logo + details); we just download the blob.
  const downloadInvoice = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      const blob = await BillingService.getInvoicePdf(inv.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Trueyy-invoice-${inv.cycle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showError('Could not download the invoice. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: 'cycle', header: 'Cycle', width: 90, render: (inv) => <Box sx={{ color: TOKENS.textPrimary }}>#{inv.cycle}</Box> },
    {
      key: 'amount', header: 'Amount',
      render: (inv) => (
        <Box sx={{ color: TOKENS.textPrimary }}>
          {inv.currency === 'INR' ? `₹${(inv.amount / 100).toLocaleString('en-IN')}` : `${inv.currency} ${inv.amount / 100}`}
        </Box>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (inv) => (
        <Chip
          label={inv.status}
          size="small"
          sx={{
            fontSize: '0.7rem', fontWeight: 600, height: 20,
            bgcolor: inv.status === 'completed' ? 'rgba(76,217,100,0.14)' : 'rgba(250,204,21,0.15)',
            color: inv.status === 'completed' ? '#047857' : '#B45309',
          }}
        />
      ),
    },
    { key: 'date', header: 'Date', hideOn: 'mobile', render: (inv) => <Box sx={{ color: TOKENS.textSecondary }}>{inv.paid_at ? formatDate(inv.paid_at) : '—'}</Box> },
    { key: 'paymentId', header: 'Payment ID', hideOn: 'mobile', render: (inv) => <Box sx={{ color: TOKENS.textMuted, fontSize: '0.75rem', fontFamily: 'monospace' }}>{inv.razorpay_payment_id ?? '—'}</Box> },
    {
      key: 'download', header: '', align: 'right', width: 56, showOnHover: true,
      render: (inv) =>
        downloadingId === inv.id ? (
          <CircularProgress size={18} sx={{ color: TOKENS.brand }} />
        ) : (
          <Tooltip title="Download invoice">
            <IconButton className="row-action" size="small" onClick={() => downloadInvoice(inv)} sx={{ color: TOKENS.brand }}>
              <FileDownloadOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
    },
  ];

  if (loading && !subscription) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} sx={{ color: TOKENS.brand }} />
      </Box>
    );
  }

  // No subscription → send the user to the dedicated plans page.
  if (!subscription) {
    return (
      <Box sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
          No active subscription. Choose a plan to get started.
        </Box>
        <ActionButton onClick={() => navigate('/plans')}>View plans</ActionButton>
      </Box>
    );
  }

  const { plan, status, current_period_end, is_auto_pay, razorpay_subscription_id, short_url } = subscription;

  if (!plan) {
    return (
      <Box sx={{ py: 4, color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
        Plan data unavailable.
      </Box>
    );
  }

  const canCancel =
    !!razorpay_subscription_id &&
    status !== 'cancelled' &&
    status !== 'completed' &&
    status !== 'trial' &&
    status !== 'created';

  const handleCancel = async () => {
    if (!razorpay_subscription_id) return;
    setCancelling(true);
    try {
      await BillingService.cancelSubscription(razorpay_subscription_id);
      showSuccess('Subscription cancelled. Access continues until the period ends.');
      setCancelOpen(false);
      onRefresh();
    } catch (err: any) {
      showError(err?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Box sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {status === 'halted' && (
        <Alert severity="error" sx={{ borderRadius: '10px' }}>
          Payment failed — interviews are locked. Update your payment method via Razorpay to restore access.
        </Alert>
      )}
      {status === 'trial' && (
        <Alert severity="info" sx={{ borderRadius: '10px' }}>
          You're on a free trial. Upgrade to unlock more interviews and seats.
        </Alert>
      )}
      {status === 'created' && (
        <Alert
          severity="warning"
          sx={{ borderRadius: '10px' }}
          action={
            short_url ? (
              <Button
                size="small"
                href={short_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Complete payment
              </Button>
            ) : undefined
          }
        >
          Subscription created but payment not yet received. Complete checkout to activate.
        </Alert>
      )}

      {/* Plan card */}
      <Box sx={{ bgcolor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CardTitle sx={{ color: TOKENS.textPrimary }}>{plan.name}</CardTitle>
              <StatusPill status={status} />
            </Box>
            <Secondary sx={{ color: TOKENS.textSecondary }}>
              {formatPrice(plan.amount, plan.currency, plan.interval)}
            </Secondary>
          </Box>
          <ActionButton onClick={() => navigate('/plans')}>
            {status === 'trial' ? 'Upgrade plan' : 'Change plan'}
          </ActionButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          <PlanDetail label="Interviews / cycle" value={String(plan.interviews_per_cycle)} />
          <PlanDetail label="Minutes per interview" value={`${plan.minutes_per_interview}m`} />
          <PlanDetail label="Seat cap" value={plan.max_seats === null ? 'Unlimited' : String(plan.max_seats)} />
        </Box>

        {current_period_end && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Caption sx={{ color: TOKENS.textMuted }}>{is_auto_pay ? 'Renews on' : 'Access until'}</Caption>
            <Caption sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{formatDate(current_period_end)}</Caption>
          </Box>
        )}
      </Box>

      {/* Danger zone */}
      {canCancel && (
        <Box sx={{ bgcolor: TOKENS.bgCard, border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', p: 2.5 }}>
          <SubHeading sx={{ color: TOKENS.error, mb: 0.5 }}>⚠ Cancel subscription</SubHeading>
          <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>
            Cancelling stops future charges. Your current plan remains active until{' '}
            <Box component="span" sx={{ fontWeight: 600, color: TOKENS.textPrimary }}>{formatDate(current_period_end)}</Box>
            . After that, you'll lose access to all features.
          </Secondary>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setCancelOpen(true)}
            sx={{
              textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', borderRadius: '8px',
              color: TOKENS.error, borderColor: 'rgba(239,68,68,0.4)',
              '&:hover': { borderColor: TOKENS.error, bgcolor: 'rgba(239,68,68,0.04)' },
            }}
          >
            Cancel subscription
          </Button>
        </Box>
      )}

      {/* Invoices — label sits outside; the table itself reuses the shared
          DataTable so rows + column headers match the Interviews/Users tables. */}
      <Box>
        <CardTitle sx={{ color: TOKENS.textPrimary, mb: 1.5 }}>Invoices</CardTitle>
        <DataTable<Invoice>
          columns={invoiceColumns}
          rows={invoices}
          rowKey={(r) => r.id}
          loading={loadingInvoices}
          emptyText="No invoices yet."
          pagination={{
            page: invoicesPage,
            pageSize: invoicesPageSize,
            total: invoicesTotal,
            onChange: (p, sz) => { setInvoicesPage(p); setInvoicesPageSize(sz); },
          }}
        />
      </Box>

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 700, pb: 1 }}>Cancel subscription?</DialogTitle>
        <DialogContent>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Your plan stays active until{' '}
            <Box component="strong" sx={{ color: TOKENS.textPrimary }}>{formatDate(current_period_end)}</Box>
            . After that, access reverts to the free trial. This cannot be undone.
          </Secondary>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={() => setCancelOpen(false)} disabled={cancelling}>
            Keep subscription
          </ActionButton>
          <Button
            onClick={handleCancel}
            disabled={cancelling}
            startIcon={cancelling ? <CircularProgress size={16} thickness={5} sx={{ color: '#fff' }} /> : undefined}
            sx={{
              textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', borderRadius: '8px', px: 2, py: 1,
              bgcolor: TOKENS.error, color: '#fff',
              '&:hover': { bgcolor: '#B91C1C' },
              '&.Mui-disabled': { bgcolor: TOKENS.border, color: TOKENS.textMuted },
            }}
          >
            {cancelling ? 'Cancelling…' : 'Yes, cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PlanDetail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Overline sx={{ color: TOKENS.textMuted }}>{label}</Overline>
      <Box sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary, mt: 0.25 }}>{value}</Box>
    </Box>
  );
}
