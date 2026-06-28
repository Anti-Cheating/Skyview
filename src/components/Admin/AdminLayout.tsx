import { useCallback, useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TOKENS } from '../../theme';
import { Sidebar } from '../layout/Sidebar';
import type { LogoConfig, NavItem, ProfileConfig } from '../layout/sidebar.types';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDisplayName } from '../../utils/user.utils';

const DRAWER_WIDTH = 280;

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'Dashboard', route: '/admin/dashboard', badge: null },
  { id: 'companies', label: 'Companies', iconName: 'Business', route: '/admin/companies', badge: null },
  { id: 'billing', label: 'Billing', iconName: 'CreditCard', route: '/admin/billing', badge: null },
  { id: 'licensing', label: 'Licensing', iconName: 'VpnKey', route: '/admin/licensing', badge: null },
  { id: 'ops', label: 'Operations', iconName: 'Hub', route: '/admin/ops', badge: null },
  { id: 'audit', label: 'Audit', iconName: 'History', route: '/admin/audit', badge: null },
  { id: 'contact', label: 'Contact', iconName: 'Mail', route: '/admin/contact', badge: null },
  { id: 'plans', label: 'Plans', iconName: 'Plans', route: '/admin/plans', badge: null },
  { id: 'profile', label: 'Profile', iconName: 'Person', route: '/admin/profile', badge: null },
];

/** Separate admin shell — its own sidebar + routes. The customer AppLayout is
 *  untouched. Design system (MUI + Sidebar) reused as-is. */
export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  const logo: LogoConfig = { label: 'Trueyy Admin', route: '/admin/companies', iconName: 'Dashboard' };
  const profile: ProfileConfig = { id: 'profile', label: getUserDisplayName(user), avatarUrl: user?.avatar_url ?? undefined, route: '/admin/companies' };
  const activeId = NAV.find((n) => location.pathname.startsWith(n.route))?.id ?? 'companies';
  const handleNavigate = useCallback(
    (route: string) => { navigate(route); if (isMobile) setMobileOpen(false); },
    [navigate, isMobile],
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        logo={logo}
        items={NAV}
        profile={profile}
        collapsed={isMobile ? !mobileOpen : false}
        onToggle={toggleMobile}
        onNavigate={handleNavigate}
        activeId={activeId}
        width={DRAWER_WIDTH}
      />
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{ flexGrow: 1, bgcolor: 'background.default', width: '100%', height: '100vh', overflow: 'auto', position: 'relative', '&:focus': { outline: 'none' } }}
      >
        {isMobile && (
          <Box sx={{ px: 1.5, minHeight: 64, bgcolor: TOKENS.sidebar, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1100 }}>
            <IconButton onClick={toggleMobile} size="small" aria-label="Open navigation" sx={{ color: '#fff', mr: 'auto' }}>
              <MenuIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        )}
        {/* No padding here — each admin page owns its `p:{xs:2,md:3}` wrapper,
            exactly like the customer pages under AppLayout. */}
        <Outlet />
      </Box>
    </Box>
  );
}
