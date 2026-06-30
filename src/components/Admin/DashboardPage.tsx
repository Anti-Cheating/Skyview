import { useEffect, useState, type ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import {
  Business as BusinessIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  People as PeopleIcon,
  CreditCard as CreditCardIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Videocam as VideocamIcon,
  PlayCircleOutline as PlayCircleIcon,
  Webhook as WebhookIcon,
  ContactSupport as ContactSupportIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, CardTitle, Caption } from '../layout/Typography';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface Dashboard {
  companies: number;
  cloud: number;
  self_hosted: number;
  users: number;
  active_subscriptions: number;
  mrr_paise: number;
  lifetime_revenue_paise: number;
  interviews: number;
  active_interviews: number;
  failed_webhooks: number;
  contact_queries: number;
  licenses: number;
  by_plan: Record<string, number>;
  by_status: Record<string, number>;
}

const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function StatCard({ label, value, icon, bgColor }: { label: string; value: ReactNode; icon: ReactNode; bgColor: string }) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: '12px',
        border: `1px solid ${TOKENS.border}`,
        bgcolor: TOKENS.bgCard,
        height: '100%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: { xs: 40, md: 48 },
              height: { xs: 40, md: 48 },
              borderRadius: '12px',
              bgcolor: bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography
          component="p"
          sx={{
            color: TOKENS.textPrimary,
            mb: 0.5,
            fontSize: { xs: '1.75rem', md: '2.25rem' },
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: TOKENS.textSecondary, fontWeight: 500 }}>
          {label}
        </Typography>
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

const ICON = (C: typeof BusinessIcon, color: string) => <C sx={{ fontSize: 24, color }} />;

export default function DashboardPage() {
  const { showError } = useSnackbar();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    let active = true;
    AdminService.dashboard()
      .then((r) => { if (active) setData((r.data as Dashboard) ?? null); })
      .catch((e: any) => showError(e?.message || 'Failed to load dashboard'));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data;
  const cards: { label: string; value: ReactNode; icon: ReactNode; bg: string }[] = [
    { label: 'Companies', value: d?.companies ?? 0, icon: ICON(BusinessIcon, TOKENS.brand), bg: 'rgba(76, 217, 100, 0.15)' },
    { label: 'Cloud', value: d?.cloud ?? 0, icon: ICON(CloudIcon, '#3B82F6'), bg: 'rgba(59, 130, 246, 0.12)' },
    { label: 'Self-hosted', value: d?.self_hosted ?? 0, icon: ICON(StorageIcon, '#6B7280'), bg: 'rgba(107, 114, 128, 0.12)' },
    { label: 'Users', value: d?.users ?? 0, icon: ICON(PeopleIcon, TOKENS.brand), bg: 'rgba(76, 217, 100, 0.15)' },
    { label: 'Active subscriptions', value: d?.active_subscriptions ?? 0, icon: ICON(CreditCardIcon, '#3B82F6'), bg: 'rgba(59, 130, 246, 0.12)' },
    { label: 'MRR', value: rupees(d?.mrr_paise ?? 0), icon: ICON(AttachMoneyIcon, TOKENS.success), bg: 'rgba(5, 150, 105, 0.12)' },
    { label: 'Lifetime revenue', value: rupees(d?.lifetime_revenue_paise ?? 0), icon: ICON(TrendingUpIcon, TOKENS.success), bg: 'rgba(5, 150, 105, 0.12)' },
    { label: 'Interviews', value: d?.interviews ?? 0, icon: ICON(VideocamIcon, '#3B82F6'), bg: 'rgba(59, 130, 246, 0.12)' },
    { label: 'Active interviews', value: d?.active_interviews ?? 0, icon: ICON(PlayCircleIcon, TOKENS.brand), bg: 'rgba(76, 217, 100, 0.15)' },
    { label: 'Failed webhooks', value: d?.failed_webhooks ?? 0, icon: ICON(WebhookIcon, TOKENS.error), bg: 'rgba(239, 68, 68, 0.12)' },
    { label: 'Open contact queries', value: d?.contact_queries ?? 0, icon: ICON(ContactSupportIcon, '#6B7280'), bg: 'rgba(107, 114, 128, 0.12)' },
    { label: 'Licenses', value: d?.licenses ?? 0, icon: ICON(VpnKeyIcon, TOKENS.brand), bg: 'rgba(76, 217, 100, 0.15)' },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Dashboard</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Platform overview</Secondary>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 3,
          mb: 4,
        }}
      >
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} bgColor={c.bg} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        <BreakdownCard title="By plan" data={d?.by_plan ?? {}} />
        <BreakdownCard title="By status" data={d?.by_status ?? {}} />
      </Box>
    </Box>
  );
}
