import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, CircularProgress, Alert, Button,
} from '@mui/material';
import { TOKENS } from '../../theme';
import { CardTitle, Caption, Secondary } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { BillingService } from '../../services/billing.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { Plan } from '../../types/billing.types';

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

function formatPrice(paise: number, currency: string, interval: string | null = 'monthly'): string {
  if (paise === 0) return 'Free';
  const amount = paise / 100;
  const period = interval === 'yearly' ? 'year' : 'month';
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}/${period}`;
  return `${currency} ${amount}/${period}`;
}

interface Props {
  open: boolean;
  currentPlanKey: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlanSelectModal({ open, currentPlanKey, onClose, onSuccess }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingPlans(true);
    setScriptError(false);
    Promise.all([BillingService.listPlans(), loadRazorpayScript()])
      .then(([planList, scriptOk]) => {
        // Filter out trial — not a purchasable plan
        setPlans(planList.filter((p) => p.plan_key !== 'trial'));
        if (!scriptOk) setScriptError(true);
      })
      .catch((err: any) => showError(err?.message || 'Failed to load plans'))
      .finally(() => setLoadingPlans(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectPlan = async (plan: Plan) => {
    if (scriptError) {
      showError('Payment system unavailable. Refresh and try again.');
      return;
    }
    setBusyPlan(plan.plan_key);
    try {
      const creds = await BillingService.createSubscription(plan.plan_key);
      const rzp = new window.Razorpay({
        key: creds.key_id,
        subscription_id: creds.subscription_id,
        name: 'Trueyy',
        description: `${plan.name} Plan`,
        handler: async (response) => {
          try {
            await BillingService.verifySubscription(response);
            showSuccess(`Upgraded to ${plan.name}!`);
            onSuccess();
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

  const anyBusy = busyPlan !== null;

  return (
    <Dialog open={open} onClose={anyBusy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: '1.125rem', fontWeight: 700, pb: 1 }}>
        Choose a plan
      </DialogTitle>
      <DialogContent>
        <Secondary sx={{ color: TOKENS.textSecondary, mb: 2.5 }}>
          Payment is processed securely via Razorpay. Upgrades take effect immediately.
        </Secondary>

        {scriptError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
            Payment system failed to load. Refresh the page and try again.
          </Alert>
        )}

        {loadingPlans ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: TOKENS.brand }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {plans.map((plan) => {
              const isCurrent = plan.plan_key === currentPlanKey;
              const isBusy = busyPlan === plan.plan_key;
              return (
                <Box
                  key={plan.id}
                  sx={{
                    border: `1px solid ${isCurrent ? TOKENS.brand : TOKENS.border}`,
                    borderRadius: '12px',
                    p: 2,
                    bgcolor: isCurrent ? TOKENS.brandBg : TOKENS.bgCard,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    opacity: anyBusy && !isBusy ? 0.5 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <CardTitle sx={{ color: TOKENS.textPrimary }}>{plan.name}</CardTitle>
                      {isCurrent && (
                        <Box
                          component="span"
                          sx={{
                            px: 0.75,
                            py: 0.25,
                            borderRadius: '4px',
                            bgcolor: TOKENS.brand,
                            color: '#fff',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Current
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Caption sx={{ color: TOKENS.textSecondary }}>
                        {plan.interviews_per_cycle} interviews/cycle
                      </Caption>
                      <Caption sx={{ color: TOKENS.textSecondary }}>
                        {plan.minutes_per_interview}m/interview
                      </Caption>
                      <Caption sx={{ color: TOKENS.textSecondary }}>
                        {plan.max_seats === null ? 'Unlimited seats' : `${plan.max_seats} seats`}
                      </Caption>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                    <Box sx={{ fontSize: '1rem', fontWeight: 700, color: TOKENS.textPrimary }}>
                      {formatPrice(plan.amount, plan.currency, plan.interval)}
                    </Box>
                    {!isCurrent && (
                      <ActionButton
                        onClick={() => handleSelectPlan(plan)}
                        loading={isBusy}
                        disabled={anyBusy}
                        sx={{ minWidth: 72 }}
                      >
                        {isBusy ? 'Opening…' : 'Select'}
                      </ActionButton>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={anyBusy}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            color: TOKENS.textSecondary,
            '&:hover': { color: TOKENS.textPrimary, bgcolor: TOKENS.borderLight },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
