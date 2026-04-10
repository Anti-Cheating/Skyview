import { useState, useEffect } from 'react';
import { Box, IconButton, useTheme, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Sidebar } from '../layout/Sidebar';
import type { LogoConfig, NavItem, SecondaryNavItem, ProfileConfig } from '../layout/sidebar.types';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDisplayName } from '../../utils/user.utils';
import AppDashboard from './AppDashboard';
import AppInterviewList from './AppInterviewList';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 64;

export default function AppLayout() {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-collapse on mobile
  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile, currentView]);

  const sidebarLogo: LogoConfig = {
    label: 'Trueyy',
    route: '/',
    iconName: 'Dashboard',
  };

  const sidebarItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', iconName: 'Dashboard', route: '/dashboard', badge: null },
    { id: 'interviews', label: 'Interviews', iconName: 'Interviews', route: '/interviews', badge: null },
  ];

  const sidebarSecondary: SecondaryNavItem[] = [];

  const sidebarProfile: ProfileConfig = {
    id: 'profile',
    label: getUserDisplayName(user),
    avatarUrl: undefined,
    route: '/profile',
  };

  const handleNavigate = (route: string) => {
    if (route === '/dashboard' || route === '/' || route === '/profile') {
      setCurrentView('dashboard');
    } else if (route === '/interviews') {
      setCurrentView('interviews');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        logo={sidebarLogo}
        items={sidebarItems}
        secondary={sidebarSecondary}
        profile={sidebarProfile}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={handleNavigate}
        activeId={currentView}
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
        {sidebarCollapsed && (
          <IconButton
            onClick={() => setSidebarCollapsed(false)}
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 10,
              color: '#FFFFFF',
              bgcolor: '#0B1A10',
              border: '1px solid rgba(76, 217, 100, 0.2)',
              '&:hover': { bgcolor: '#142A1A' },
            }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        )}

        {currentView === 'dashboard' && <AppDashboard onNavigate={handleNavigate} />}
        {currentView === 'interviews' && <AppInterviewList />}
      </Box>
    </Box>
  );
}
