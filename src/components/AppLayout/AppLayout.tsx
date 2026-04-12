import { Box } from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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

  // Sidebar is always open in Skyview — never collapsed
  const sidebarCollapsed = false;

  const sidebarLogo: LogoConfig = {
    label: 'Trueyy',
    route: '/',
    iconName: 'Dashboard',
  };

  const sidebarItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', iconName: 'Dashboard', route: '/', badge: null },
    { id: 'interviews', label: 'Interviews', iconName: 'Interviews', route: '/interviews', badge: null },
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
    if (location.pathname.startsWith('/interviews')) return 'interviews';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'dashboard';
  };

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
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
        <Outlet />
      </Box>
    </Box>
  );
}
