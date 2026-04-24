import { useCallback, useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TruoyyLogo } from '../layout/TruoyyLogo';
import { TOKENS } from '../../theme';
import { Sidebar } from '../layout/Sidebar';
import type { LogoConfig, NavItem, ProfileConfig } from '../layout/sidebar.types';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDisplayName } from '../../utils/user.utils';
import { USER_ROLES, isCompanyManagerRole } from '../../config/constants';

const DRAWER_WIDTH = 280;

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mobile-only state — on desktop the sidebar is always open, no toggle.
  // On mobile, `mobileOpen` controls the temporary overlay drawer.
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  const userRole = user?.role || USER_ROLES.CANDIDATE;

  const sidebarLogo: LogoConfig = {
    label: 'Trueyy',
    route: '/',
    iconName: 'Dashboard',
  };

  // Role-aware primary nav. Candidates get a minimal nav (their dashboard
  // + scheduled interviews). Only Owners / Admins / System Admins see the
  // Team tab — Members can't manage the team, so showing the tab to them
  // just leads to an info-only page. The route itself is also guarded in
  // App.tsx so a Member manually typing /team gets redirected.
  const sidebarItems: NavItem[] = (() => {
    const shared: NavItem[] = [
      { id: 'dashboard',  label: 'Dashboard',  iconName: 'Dashboard',  route: '/',           badge: null },
      { id: 'interviews', label: 'Interviews', iconName: 'Interviews', route: '/interviews', badge: null },
    ];
    if (isCompanyManagerRole(userRole)) {
      shared.push({ id: 'team', label: 'Team', iconName: 'Person', route: '/team', badge: null });
    }
    return shared;
  })();

  const sidebarProfile: ProfileConfig = {
    id: 'profile',
    label: getUserDisplayName(user),
    avatarUrl: undefined,
    route: '/profile',
  };

  const getActiveId = (): string => {
    if (location.pathname.startsWith('/interviews')) return 'interviews';
    if (location.pathname.startsWith('/team')) return 'team';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'dashboard';
  };

  const handleNavigate = useCallback(
    (route: string) => {
      navigate(route);
      if (isMobile) setMobileOpen(false);
    },
    [navigate, isMobile]
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        logo={sidebarLogo}
        items={sidebarItems}
        profile={sidebarProfile}
        // Desktop: Sidebar ignores these (always open). Mobile: `collapsed`
        // means "overlay closed", and `onToggle` closes it.
        collapsed={isMobile ? !mobileOpen : false}
        onToggle={toggleMobile}
        onNavigate={handleNavigate}
        activeId={getActiveId()}
        width={DRAWER_WIDTH}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          width: '100%',
          height: '100vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Mobile header — hamburger opens the overlay sidebar */}
        {isMobile && (
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              bgcolor: TOKENS.sidebar,
              display: 'flex',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 1100,
            }}
          >
            <IconButton
              onClick={toggleMobile}
              size="small"
              aria-label="Open navigation"
              sx={{ color: '#fff', mr: 'auto' }}
            >
              <MenuIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ transform: 'scale(0.7)', transformOrigin: 'right center' }}>
              <TruoyyLogo collapsed={false} size="small" />
            </Box>
          </Box>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
