import { Box, LinearProgress, CircularProgress } from '@mui/material';
import { TOKENS } from '../../theme';
import { Caption, Overline } from '../layout/Typography';
import type { Subscription } from '../../types/billing.types';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

interface Props {
  subscription: Subscription | null;
  loading: boolean;
}

export function UsageTab({ subscription, loading }: Props) {
  if (loading && !subscription) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} sx={{ color: TOKENS.brand }} />
      </Box>
    );
  }

  if (!subscription) {
    return (
      <Box sx={{ py: 4, color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
        Choose a plan to view usage statistics.
      </Box>
    );
  }

  const {
    plan,
    interviews_used,
    interviews_remaining,
    seats_used,
    started_at,
    current_period_end,
  } = subscription;

  if (!plan) {
    return (
      <Box sx={{ py: 4, color: TOKENS.textSecondary, fontSize: '0.875rem' }}>
        Plan data unavailable.
      </Box>
    );
  }

  const total = interviews_used + interviews_remaining;
  const usedPct = total > 0 ? (interviews_used / total) * 100 : 0;
  const barColor =
    usedPct >= 90 ? TOKENS.error : usedPct >= 70 ? TOKENS.warning : TOKENS.brand;

  return (
    <Box sx={{ pt: 3 }}>
      {(started_at || current_period_end) && (
        <Box
          sx={{
            mb: 3,
            px: 2,
            py: 1.5,
            bgcolor: TOKENS.bgCard,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Overline sx={{ color: TOKENS.textMuted }}>Billing period</Overline>
          <Box sx={{ flex: 1 }} />
          <Caption sx={{ color: TOKENS.textSecondary }}>
            {formatDate(started_at)} — {formatDate(current_period_end)}
          </Caption>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {/* Interviews used */}
        <StatCard>
          <Overline sx={{ color: TOKENS.textMuted, mb: 1 }}>Interviews used</Overline>
          <Box sx={{ fontSize: '1.5rem', fontWeight: 700, color: TOKENS.textPrimary, lineHeight: 1 }}>
            {interviews_used}
            <Box
              component="span"
              sx={{ fontSize: '0.875rem', fontWeight: 400, color: TOKENS.textSecondary, ml: 0.5 }}
            >
              / {total}
            </Box>
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(usedPct, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: TOKENS.borderLight,
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
              }}
            />
          </Box>
          <Caption sx={{ color: TOKENS.textMuted, mt: 0.75 }}>
            {interviews_remaining} remaining this cycle
          </Caption>
        </StatCard>

        {/* Remaining */}
        <StatCard>
          <Overline sx={{ color: TOKENS.textMuted, mb: 1 }}>Remaining</Overline>
          <Box
            sx={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: interviews_remaining === 0 ? TOKENS.error : TOKENS.textPrimary,
              lineHeight: 1,
            }}
          >
            {interviews_remaining}
          </Box>
          <Caption sx={{ color: TOKENS.textSecondary, mt: 0.75 }}>
            {plan.interviews_per_cycle} total per cycle
          </Caption>
        </StatCard>

        {/* Seats */}
        <StatCard>
          <Overline sx={{ color: TOKENS.textMuted, mb: 1 }}>Seats used</Overline>
          <Box sx={{ fontSize: '1.5rem', fontWeight: 700, color: TOKENS.textPrimary, lineHeight: 1 }}>
            {seats_used}
            {plan.max_seats !== null && (
              <Box
                component="span"
                sx={{ fontSize: '0.875rem', fontWeight: 400, color: TOKENS.textSecondary, ml: 0.5 }}
              >
                / {plan.max_seats}
              </Box>
            )}
          </Box>
          <Caption sx={{ color: TOKENS.textSecondary, mt: 0.75 }}>
            {plan.max_seats === null ? 'Unlimited seats' : `${plan.max_seats} seat${plan.max_seats !== 1 ? 's' : ''} total`}
          </Caption>
        </StatCard>

      </Box>
    </Box>
  );
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: TOKENS.bgCard,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: '12px',
        p: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </Box>
  );
}
