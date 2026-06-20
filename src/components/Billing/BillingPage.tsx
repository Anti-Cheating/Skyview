import { useCallback, useEffect, useState } from 'react';
import { Box, Tabs, Tab, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { PageTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { isCompanyManagerRole } from '../../config/constants';
import { BillingService } from '../../services/billing.service';
import { UsageTab } from './UsageTab';
import { BillingTab } from './BillingTab';
import type { Subscription } from '../../types/billing.types';

type TabValue = 'usage' | 'billing';

const TAB_SX = {
  mb: 0,
  minHeight: 36,
  borderBottom: `1px solid ${TOKENS.border}`,
  '& .MuiTabs-flexContainer': { gap: 2.5 },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    minHeight: 36,
    px: 0,
    py: 1,
    minWidth: 0,
    color: TOKENS.textSecondary,
    '&:hover': { color: TOKENS.textPrimary },
  },
  '& .Mui-selected': { color: `${TOKENS.textPrimary} !important`, fontWeight: 600 },
  '& .MuiTabs-indicator': { backgroundColor: TOKENS.brand, height: 2 },
} as const;

export default function BillingPage() {
  const { user } = useAuth();
  const { showError } = useSnackbar();
  const [tab, setTab] = useState<TabValue>('usage');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sub = await BillingService.getSubscription();
      setSubscription(sub);
    } catch (err: any) {
      showError(err?.message || 'Failed to load billing info');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isCompanyManagerRole(user?.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Only Owners and Admins can manage billing.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Billing & Usage</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Manage your subscription and track usage.
          </Secondary>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v: TabValue) => setTab(v)} sx={TAB_SX}>
        <Tab value="usage" label="Usage" />
        <Tab value="billing" label="Billing" />
      </Tabs>

      {tab === 'usage' && (
        <motion.div
          key="usage"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <UsageTab subscription={subscription} loading={loading} />
        </motion.div>
      )}

      {tab === 'billing' && (
        <motion.div
          key="billing"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <BillingTab subscription={subscription} loading={loading} onRefresh={refresh} />
        </motion.div>
      )}
    </Box>
  );
}
