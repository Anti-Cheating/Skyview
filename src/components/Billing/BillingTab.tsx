import { useEffect, useState } from 'react';
import {
  Box, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Collapse, Table, TableBody, TableCell, TableHead, TableRow, Chip,
  IconButton, Tooltip,
} from '@mui/material';
import { FileDownloadOutlined } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary, Caption, Overline, SubHeading } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { BillingService } from '../../services/billing.service';
import { PlanSelectModal } from './PlanSelectModal';
import type { Subscription, SubscriptionStatus, Plan, Invoice } from '../../types/billing.types';

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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        height: 22,
        borderRadius: '6px',
        bgcolor: c.bg,
        color: c.fg,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <Box
        component="span"
        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }}
      />
      {c.label}
    </Box>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
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

  // Server renders a branded PDF (logo + details); we just download the blob.
  const downloadInvoice = async (inv: Invoice) => {
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
    }
  };
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plansExpanded, setPlansExpanded] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('');
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    setLoadingInvoices(true);
    BillingService.listInvoices()
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [subscription]);

  useEffect(() => {
    if (plansExpanded && plans.length === 0) {
      setLoadingPlans(true);
      BillingService.listPlans()
        .then(setPlans)
        .catch(err => showError(err?.message || 'Failed to load plans'))
        .finally(() => setLoadingPlans(false));
    }
  }, [plansExpanded]);

  const handleSelectPlan = async (planKey: string) => {
    setProcessingPlan(planKey);
    try {
      if (planKey === 'trial') {
        await BillingService.createSubscription(planKey);
        showSuccess('Trial activated! No card required.');
        setPlansExpanded(false);
        onRefresh();
        return;
      }

      const creds = await BillingService.createSubscription(planKey);
      if (typeof window.Razorpay !== 'undefined') {
        const rzp = new window.Razorpay({
          key: creds.key_id,
          subscription_id: creds.subscription_id,
          name: 'Trueyy',
          description: 'Interview Monitoring Platform',
          handler: (response: any) => {
            BillingService.verifySubscription({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            })
              .then(() => {
                showSuccess('Payment successful! Subscription activated.');
                setPlansExpanded(false);
                onRefresh();
              })
              .catch(err => showError(err?.message || 'Payment verification failed'));
          },
          modal: { ondismiss: () => setProcessingPlan(null) },
          theme: { color: '#4CD964' },
        });
        rzp.open();
      } else {
        showError('Razorpay not loaded');
      }
    } catch (err) {
      showError((err as any)?.message || 'Failed to create subscription');
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading && !subscription) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} sx={{ color: TOKENS.brand }} />
      </Box>
    );
  }

  if (!subscription) {
    return (
      <Box sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
          No active subscription. Choose a plan to get started.
        </Box>
        <ActionButton onClick={() => setPlansExpanded(!plansExpanded)}>
          {plansExpanded ? 'Hide Plans' : 'View Plans'}
        </ActionButton>
        <Collapse in={plansExpanded}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center' }}>
            <Button
              variant={selectedInterval === 'monthly' ? 'contained' : 'outlined'}
              onClick={() => setSelectedInterval('monthly')}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                borderColor: selectedInterval === 'monthly' ? TOKENS.brand : TOKENS.border,
                color: selectedInterval === 'monthly' ? '#fff' : TOKENS.textPrimary,
                backgroundColor: selectedInterval === 'monthly' ? TOKENS.brand : 'transparent',
              }}
            >
              Monthly
            </Button>
            <Button
              variant={selectedInterval === 'yearly' ? 'contained' : 'outlined'}
              onClick={() => setSelectedInterval('yearly')}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                borderColor: selectedInterval === 'yearly' ? TOKENS.brand : TOKENS.border,
                color: selectedInterval === 'yearly' ? '#fff' : TOKENS.textPrimary,
                backgroundColor: selectedInterval === 'yearly' ? TOKENS.brand : 'transparent',
              }}
            >
              Yearly
            </Button>
          </Box>
        </Collapse>
        <Collapse in={plansExpanded}>
          {loadingPlans ? (
            <CircularProgress size={24} sx={{ color: TOKENS.brand }} />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2 }}>
              {plans
                .filter(p => !p.interval || p.interval === selectedInterval)
                .sort((a, b) => {
                  const tierOrder: Record<string, number> = { trial: 0, starter: 1, growth: 2 };
                  const aOrder = tierOrder[a.plan_key.split('_')[0]] ?? 999;
                  const bOrder = tierOrder[b.plan_key.split('_')[0]] ?? 999;
                  return aOrder - bOrder;
                })
                .map((plan) => (
                <Box
                  key={plan.id}
                  sx={{
                    bgcolor: TOKENS.bgCard,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: '12px',
                    p: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <CardTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>{plan.name}</CardTitle>
                    <Box sx={{ fontSize: '1.75rem', fontWeight: 700, color: TOKENS.brand, mb: 0.5 }}>
                      {plan.amount === 0 ? '₹0' : `₹${(plan.amount / 100).toLocaleString('en-IN')}`}
                    </Box>
                    <Caption sx={{ color: TOKENS.textSecondary }}>
                      {plan.amount > 0 && `${plan.interval === 'yearly' ? 'per year' : 'per month'}`}
                      {plan.amount === 0 && 'No card required'}
                    </Caption>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                    {Array.isArray(plan.features) && plan.features.map((feature: string, idx: number) => (
                      <Caption key={idx} sx={{ color: TOKENS.textSecondary, fontWeight: 500 }}>
                        ✓ {feature}
                      </Caption>
                    ))}
                  </Box>
                  <ActionButton
                    onClick={() => handleSelectPlan(plan.plan_key)}
                    loading={processingPlan === plan.plan_key}
                    disabled={processingPlan !== null}
                    sx={{ width: '100%' }}
                  >
                    {plan.plan_key === 'trial' ? 'Start Free' : 'Select'}
                  </ActionButton>
                </Box>
              ))}
            </Box>
          )}
        </Collapse>
        <PlanSelectModal
          open={planModalOpen}
          currentPlanKey={selectedPlanKey}
          onClose={() => {
            setPlanModalOpen(false);
            setSelectedPlanKey('');
          }}
          onSuccess={() => {
            setPlanModalOpen(false);
            setPlansExpanded(false);
            setSelectedPlanKey('');
            onRefresh();
          }}
        />
      </Box>
    );
  }

  const { plan, status, current_period_end, is_auto_pay, razorpay_subscription_id } = subscription;

  if (!plan) {
    return (
      <Box sx={{ py: 4, color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
        Plan data unavailable.
      </Box>
    );
  }

  const canUpgrade = true;
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
        <Alert severity="warning" sx={{ borderRadius: '10px' }}>
          Subscription created but payment not yet received. Complete checkout to activate.
        </Alert>
      )}

      {/* Plan card */}
      <Box
        sx={{
          bgcolor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          p: 2.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CardTitle sx={{ color: TOKENS.textPrimary }}>{plan.name}</CardTitle>
              <StatusPill status={status} />
            </Box>
            <Secondary sx={{ color: TOKENS.textSecondary }}>
              {formatPrice(plan.amount, plan.currency, plan.interval)}
            </Secondary>
          </Box>
          {canUpgrade && (
            <ActionButton onClick={() => setPlanModalOpen(true)}>
              Upgrade plan
            </ActionButton>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <PlanDetail label="Interviews / cycle" value={String(plan.interviews_per_cycle)} />
          <PlanDetail label="Minutes per interview" value={`${plan.minutes_per_interview}m`} />
          <PlanDetail label="Seat cap" value={plan.max_seats === null ? 'Unlimited' : String(plan.max_seats)} />
        </Box>

        {current_period_end && (
          <Box
            sx={{
              mt: 2.5,
              pt: 2,
              borderTop: `1px solid ${TOKENS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Caption sx={{ color: TOKENS.textMuted }}>
              {is_auto_pay ? 'Renews on' : 'Access until'}
            </Caption>
            <Caption sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>
              {formatDate(current_period_end)}
            </Caption>
          </Box>
        )}
      </Box>

      {/* Danger zone */}
      {canCancel && (
        <Box
          sx={{
            bgcolor: TOKENS.bgCard,
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '12px',
            p: 2.5,
          }}
        >
          <SubHeading sx={{ color: TOKENS.error, mb: 0.5 }}>⚠ Cancel subscription</SubHeading>
          <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>
            Cancelling stops future charges. Your current plan remains active until{' '}
            <Box component="span" sx={{ fontWeight: 600, color: TOKENS.textPrimary }}>
              {formatDate(current_period_end)}
            </Box>
            . After that, you'll lose access to all features.
          </Secondary>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setCancelOpen(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              borderRadius: '8px',
              color: TOKENS.error,
              borderColor: 'rgba(239,68,68,0.4)',
              '&:hover': { borderColor: TOKENS.error, bgcolor: 'rgba(239,68,68,0.04)' },
            }}
          >
            Cancel subscription
          </Button>
        </Box>
      )}

      {/* Invoices */}
      <Box
        sx={{
          bgcolor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          p: 2.5,
        }}
      >
        <CardTitle sx={{ color: TOKENS.textPrimary, mb: 2 }}>Invoices</CardTitle>
        {loadingInvoices ? (
          <CircularProgress size={22} sx={{ color: TOKENS.brand }} />
        ) : invoices.length === 0 ? (
          <Caption sx={{ color: TOKENS.textMuted }}>No invoices yet.</Caption>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: TOKENS.textMuted, fontWeight: 600, fontSize: '0.75rem', borderColor: TOKENS.border }}>Cycle</TableCell>
                <TableCell sx={{ color: TOKENS.textMuted, fontWeight: 600, fontSize: '0.75rem', borderColor: TOKENS.border }}>Amount</TableCell>
                <TableCell sx={{ color: TOKENS.textMuted, fontWeight: 600, fontSize: '0.75rem', borderColor: TOKENS.border }}>Status</TableCell>
                <TableCell sx={{ color: TOKENS.textMuted, fontWeight: 600, fontSize: '0.75rem', borderColor: TOKENS.border }}>Date</TableCell>
                <TableCell sx={{ color: TOKENS.textMuted, fontWeight: 600, fontSize: '0.75rem', borderColor: TOKENS.border }}>Payment ID</TableCell>
                <TableCell sx={{ borderColor: TOKENS.border }} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell sx={{ color: TOKENS.textPrimary, fontSize: '0.875rem', borderColor: TOKENS.border }}>#{inv.cycle}</TableCell>
                  <TableCell sx={{ color: TOKENS.textPrimary, fontSize: '0.875rem', borderColor: TOKENS.border }}>
                    {inv.currency === 'INR' ? `₹${(inv.amount / 100).toLocaleString('en-IN')}` : `${inv.currency} ${inv.amount / 100}`}
                  </TableCell>
                  <TableCell sx={{ borderColor: TOKENS.border }}>
                    <Chip
                      label={inv.status}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: inv.status === 'completed' ? 'rgba(76,217,100,0.14)' : 'rgba(250,204,21,0.15)',
                        color: inv.status === 'completed' ? '#047857' : '#B45309',
                        height: 20,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: TOKENS.textSecondary, fontSize: '0.875rem', borderColor: TOKENS.border }}>
                    {inv.paid_at ? formatDate(inv.paid_at) : '—'}
                  </TableCell>
                  <TableCell sx={{ color: TOKENS.textMuted, fontSize: '0.75rem', fontFamily: 'monospace', borderColor: TOKENS.border }}>
                    {inv.razorpay_payment_id ?? '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ borderColor: TOKENS.border, py: 0.5 }}>
                    <Tooltip title="Download invoice">
                      <IconButton size="small" onClick={() => downloadInvoice(inv)} sx={{ color: TOKENS.brand }}>
                        <FileDownloadOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <PlanSelectModal
        open={planModalOpen}
        currentPlanKey={plan.plan_key}
        onClose={() => setPlanModalOpen(false)}
        onSuccess={() => { setPlanModalOpen(false); onRefresh(); }}
      />

      {/* Cancel confirm */}
      <Dialog open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 700, pb: 1 }}>
          Cancel subscription?
        </DialogTitle>
        <DialogContent>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Your plan stays active until{' '}
            <Box component="strong" sx={{ color: TOKENS.textPrimary }}>
              {formatDate(current_period_end)}
            </Box>
            . After that, access reverts to the free trial. This cannot be undone.
          </Secondary>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => setCancelOpen(false)}
            disabled={cancelling}
          >
            Keep subscription
          </ActionButton>
          <Button
            onClick={handleCancel}
            disabled={cancelling}
            startIcon={
              cancelling
                ? <CircularProgress size={16} thickness={5} sx={{ color: '#fff' }} />
                : undefined
            }
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRadius: '8px',
              px: 2,
              py: 1,
              bgcolor: TOKENS.error,
              color: '#fff',
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
      <Box sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary, mt: 0.25 }}>
        {value}
      </Box>
    </Box>
  );
}
