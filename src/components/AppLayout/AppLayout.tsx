import { useState } from 'react';
import { Box } from '@mui/material';
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
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Sidebar is always open in Skyview — never collapsed
  const sidebarCollapsed = false;

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
        onToggle={() => {}}
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
        {currentView === 'dashboard' && <AppDashboard onNavigate={handleNavigate} />}
        {currentView === 'interviews' && <AppInterviewList />}
      </Box>
    </Box>
  );
}
