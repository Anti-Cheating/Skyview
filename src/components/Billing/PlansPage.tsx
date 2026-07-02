import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab, CircularProgress, Chip, Tooltip } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { motion } from 'framer-motion';
import { TOKENS } from '../../theme';
import { PageTitle, CardTitle, Caption, Secondary } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { BillingService } from '../../services/billing.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { Plan, Subscription } from '../../types/billing.types';

// Same underline-tab treatment as BillingPage (Usage | Billing).
const TAB_SX = {
  mb: 0,
  minHeight: 36,
  borderBottom: `1px solid ${TOKENS.border}`,
  '& .MuiTabs-flexContainer': { gap: 2.5 },
  '& .MuiTab-root': {
    textTransform: 'none', fontWeight: 500, fontSize: '0.875rem',
    minHeight: 36, px: 0, py: 1, minWidth: 0,
    color: TOKENS.textSecondary,
    '&:hover': { color: TOKENS.textPrimary },
  },
  '& .Mui-selected': { color: `${TOKENS.textPrimary} !important`, fontWeight: 600 },
  '& .MuiTabs-indicator': { backgroundColor: TOKENS.brand, height: 2 },
} as const;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== 'undefined') { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PlansPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanKey, setCurrentPlanKey] = useState<string>('');
  const [pendingPlanKey, setPendingPlanKey] = useState<string>('');
  const [pendingSub, setPendingSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [scriptError, setScriptError] = useState(false);
  const [interval, setIntervalTab] = useState<'monthly' | 'yearly'>('monthly');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      BillingService.listPlans(),
      BillingService.getSubscription().catch(() => null),
      loadRazorpayScript(),
    ])
      .then(([planList, sub, scriptOk]) => {
        setPlans(planList);
        const isConfirmed = sub && ['trial', 'active', 'charged'].includes(sub.status);
        setCurrentPlanKey(isConfirmed ? sub.plan.plan_key : '');
        setPendingPlanKey(sub?.status === 'created' ? sub.plan.plan_key : '');
        setPendingSub(sub?.status === 'created' ? sub : null);
        if (!scriptOk) setScriptError(true);
      })
      .catch((err: any) => showError(err?.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trial (no interval) always shows; paid plans filter by the active tab. Sort by tier.
  const visiblePlans = useMemo(
    () =>
      plans
        .filter((p) => !p.interval || p.interval === interval)
        .sort((a, b) => {
          const order: Record<string, number> = { trial: 0, starter: 1, growth: 2 };
          return (order[a.plan_key.split('_')[0]] ?? 999) - (order[b.plan_key.split('_')[0]] ?? 999);
        }),
    [plans, interval]
  );

  const anyBusy = busyPlan !== null;

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.plan_key === currentPlanKey) return;
    if (plan.plan_key !== 'trial' && scriptError) {
      showError('Payment system unavailable. Refresh and try again.');
      return;
    }
    setBusyPlan(plan.plan_key);
    try {
      if (plan.plan_key === 'trial') {
        await BillingService.createSubscription(plan.plan_key);
        showSuccess('Trial activated — no card required.');
        navigate('/billing');
        return;
      }
      const creds = await BillingService.createSubscription(plan.plan_key);
      const rzp = new window.Razorpay({
        key: creds.key_id,
        subscription_id: creds.subscription_id,
        name: 'Trueyy',
        description: `${plan.name} Plan`,
        handler: async (response) => {
          try {
            await BillingService.verifySubscription(response);
            showSuccess(`You're on ${plan.name}!`);
            navigate('/billing');
          } catch (err: any) {
            showError(err?.message || 'Payment verification failed');
            setBusyPlan(null);
          }
        },
        modal: { ondismiss: () => setBusyPlan(null) },
        theme: { color: TOKENS.brand },
      });
      rzp.open();
    } catch (err: any) {
      showError(err?.message || 'Failed to start checkout');
      setBusyPlan(null);
    }
  };

  const handleCompletePayment = async (plan: Plan) => {
    if (!pendingSub?.razorpay_subscription_id || !pendingSub?.key_id) return;
    setBusyPlan(plan.plan_key);
    const rzp = new window.Razorpay({
      key: pendingSub.key_id,
      subscription_id: pendingSub.razorpay_subscription_id,
      name: 'Trueyy',
      description: `${plan.name} Plan`,
      handler: async (response) => {
        try {
          await BillingService.verifySubscription(response);
          showSuccess(`You're on ${plan.name}!`);
          navigate('/billing');
        } catch (err: any) {
          showError(err?.message || 'Payment verification failed');
          setBusyPlan(null);
        }
      },
      modal: { ondismiss: () => setBusyPlan(null) },
      theme: { color: TOKENS.brand },
    });
    rzp.open();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Choose your plan</PageTitle>
      <Secondary sx={{ color: TOKENS.textSecondary, mb: 2.5 }}>
        Start free, scale as you hire. Payment is processed securely via Razorpay.
      </Secondary>

      <Tabs value={interval} onChange={(_, v: 'monthly' | 'yearly') => setIntervalTab(v)} sx={TAB_SX}>
        <Tab value="monthly" label="Monthly" />
        <Tab value="yearly" label="Yearly" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: TOKENS.brand }} />
        </Box>
      ) : (
        <motion.div
          key={interval}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: `repeat(${Math.min(visiblePlans.length, 4)}, 1fr)` },
              gap: 2,
            }}
          >
            {visiblePlans.map((plan) => {
              const isCurrent = plan.plan_key === currentPlanKey;
              const isPending = plan.plan_key === pendingPlanKey;
              const isBusy = busyPlan === plan.plan_key;
              return (
                <Box
                  key={plan.id}
                  sx={{
                    bgcolor: isCurrent ? TOKENS.brandBg : TOKENS.bgCard,
                    border: `1px solid ${isCurrent ? TOKENS.brand : TOKENS.border}`,
                    borderRadius: '12px',
                    p: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    opacity: anyBusy && !isBusy ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <CardTitle sx={{ color: TOKENS.textPrimary }}>{plan.name}</CardTitle>
                      {isCurrent && (
                        <Chip label="Current" size="small" sx={{ bgcolor: TOKENS.brand, color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 18 }} />
                      )}
                      {isPending && (
                        <Tooltip title="Payment pending">
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375 }}>
                            <WarningAmberRoundedIcon sx={{ fontSize: 16, color: '#B45309' }} />
                            <Caption sx={{ color: '#B45309', fontWeight: 700 }}>Pending</Caption>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                    <Box sx={{ fontSize: '1.75rem', fontWeight: 700, color: TOKENS.brand, mb: 0.5 }}>
                      {plan.amount === 0 ? '₹0' : `₹${(plan.amount / 100).toLocaleString('en-IN')}`}
                    </Box>
                    <Caption sx={{ color: TOKENS.textSecondary }}>
                      {plan.amount === 0 ? 'No card required' : plan.interval === 'yearly' ? 'per year' : 'per month'}
                    </Caption>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                    <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 500 }}>✓ {plan.interviews_per_cycle} interviews / cycle</Caption>
                    <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 500 }}>✓ {plan.minutes_per_interview} min per interview</Caption>
                    <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 500 }}>✓ {plan.max_seats === null ? 'Unlimited seats' : `${plan.max_seats} team seats`}</Caption>
                    {Array.isArray(plan.features) && plan.features.map((feature: string, idx: number) => (
                      <Caption key={idx} sx={{ color: TOKENS.textSecondary, fontWeight: 500 }}>✓ {feature}</Caption>
                    ))}
                  </Box>

                  <ActionButton
                    onClick={() => isPending ? handleCompletePayment(plan) : handleSelectPlan(plan)}
                    loading={isBusy}
                    disabled={isCurrent || (anyBusy && !isBusy)}
                    sx={{ width: '100%' }}
                  >
                    {isCurrent ? 'Current plan' : isPending ? 'Complete payment' : isBusy ? 'Opening…' : plan.plan_key === 'trial' ? 'Start free' : 'Select'}
                  </ActionButton>
                </Box>
              );
            })}
          </Box>
        </motion.div>
      )}
    </Box>
  );
}
