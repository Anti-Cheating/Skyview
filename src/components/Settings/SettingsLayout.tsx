/**
 * SettingsLayout — horizontal tabs at the top + outlet below.
 *
 * Same tab pattern as TeamPage / TenantDetail: underline-style tabs
 * driven by react-router. Keeps the platform feeling like one app
 * across every "list of sub-pages" surface.
 */

import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import { PageTitle } from '../layout/Typography';
import { TOKENS } from '../../theme';

interface NavItem { to: string; label: string }

const NAV: NavItem[] = [
  { to: '/settings/tokens',    label: 'API Tokens' },
  { to: '/settings/webhooks',  label: 'Webhooks'   },
  { to: '/settings/billing',   label: 'Billing'    },
  { to: '/settings/branding',  label: 'Branding'   },
  { to: '/settings/retention', label: 'Retention'  },
];

export default function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive the selected tab from the URL so deep-links + back/forward work.
  const active = useMemo(() => {
    const hit = NAV.find((n) => location.pathname.startsWith(n.to));
    return hit?.to ?? NAV[0]!.to;
  }, [location.pathname]);

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <PageTitle sx={{ mb: 2 }}>Settings</PageTitle>

      <Tabs
        value={active}
        onChange={(_, v) => navigate(v as string)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2.5,
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
        }}
      >
        {NAV.map((n) => (
          <Tab key={n.to} value={n.to} label={n.label} />
        ))}
      </Tabs>

      <Outlet />
    </Box>
  );
}
