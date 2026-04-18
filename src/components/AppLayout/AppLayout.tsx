import { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TruoyyLogo } from '../layout/TruoyyLogo';
import { TOKENS } from '../../theme';
import { Sidebar } from '../layout/Sidebar';
import type { LogoConfig, NavItem, SecondaryNavItem, ProfileConfig } from '../layout/sidebar.types';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDisplayName } from '../../utils/user.utils';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 64;

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarCollapsed = false;

  const sidebarLogo: LogoConfig = {
    label: 'Trueyy',
    route: '/',
    iconName: 'Dashboard',
  };

  const sidebarItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', iconName: 'Dashboard', route: '/', badge: null },
    { id: 'interviews', label: 'Interviews', iconName: 'Interviews', route: '/interviews', badge: null },
    { id: 'past-interviews', label: 'Past Interviews', iconName: 'History', route: '/interviews/past', badge: null },
  ];

  const sidebarSecondary: SecondaryNavItem[] = [];

  const sidebarProfile: ProfileConfig = {
    id: 'profile',
    label: getUserDisplayName(user),
    avatarUrl: undefined,
    route: '/profile',
  };

  // Derive active sidebar item from current URL
  const getActiveId = (): string => {
    if (location.pathname === '/interviews/past') return 'past-interviews';
    if (location.pathname.startsWith('/interviews')) return 'interviews';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'dashboard';
  };

  const handleNavigate = (route: string) => {
    navigate(route);
    if (isMobile) setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop: permanent sidebar */}
      {!isMobile && (
        <Sidebar
          logo={sidebarLogo}
          items={sidebarItems}
          secondary={sidebarSecondary}
          profile={sidebarProfile}
          collapsed={sidebarCollapsed}
          onToggle={() => {}}
          onNavigate={handleNavigate}
          activeId={getActiveId()}
          width={DRAWER_WIDTH}
          collapsedWidth={DRAWER_WIDTH_COLLAPSED}
        />
      )}

      {/* Mobile: temporary drawer overlay */}
      {isMobile && mobileOpen && (
        <Box
          onClick={() => setMobileOpen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1200,
          }}
        >
          <Box onClick={(e) => e.stopPropagation()} sx={{ width: DRAWER_WIDTH, height: '100%' }}>
            <Sidebar
              logo={sidebarLogo}
              items={sidebarItems}
              secondary={sidebarSecondary}
              profile={sidebarProfile}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={handleNavigate}
              activeId={getActiveId()}
              width={DRAWER_WIDTH}
              collapsedWidth={DRAWER_WIDTH_COLLAPSED}
            />
          </Box>
        </Box>
      )}

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
        {/* Mobile header — fixed at top, same dark color as sidebar */}
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
            <IconButton onClick={() => setMobileOpen(true)} size="small" sx={{ color: '#fff', mr: 'auto' }}>
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
