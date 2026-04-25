import React, { useCallback, useMemo, useRef } from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Badge,
  Tooltip,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  ExitToApp as ExitIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { SidebarProps } from './sidebar.types';
import { TruoyyLogo } from './TruoyyLogo';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';

// Single icon family, only what the app actually renders.
const iconMap: Record<string, React.ComponentType<any>> = {
  Dashboard: DashboardIcon,
  Interviews: VideoCallIcon,
  VideoCall: VideoCallIcon,
  Settings: SettingsIcon,
  HelpOutline: HelpOutlineIcon,
  Person: PersonIcon,
  People: PeopleIcon,
  ExitToApp: ExitIcon,
};

const getInitials = (label: string): string => {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  return label.substring(0, 2).toUpperCase() || 'U';
};

const getIcon = (iconName: string): React.ComponentType<any> =>
  iconMap[iconName] || DashboardIcon;

/**
 * Sidebar — always-open left rail.
 *
 * The collapse / toggle UI was removed; the sidebar stays at its full
 * width on desktop at all times. On mobile it renders as a temporary
 * overlay drawer that AppLayout toggles via a hamburger button.
 *
 * SidebarProps keeps `collapsed` / `onToggle` purely for the mobile
 * branch: AppLayout passes `collapsed=true` when the overlay should be
 * closed and `collapsed=false` when it should be shown, and `onToggle`
 * closes it. Desktop callers can pass `collapsed=false` and a no-op
 * `onToggle` — the component ignores them.
 */
export function Sidebar({
  logo,
  items,
  secondary,
  profile,
  collapsed,
  onToggle,
  onNavigate,
  activeId,
  width = 280,
  density = 'comfortable',
}: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout } = useAuth();
  const listRef = useRef<HTMLUListElement>(null);

  const flatItems = useMemo(
    () => [...(items || []), ...(secondary || [])],
    [items, secondary]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, route: string, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate(route);
        if (isMobile) onToggle();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (index + 1) % flatItems.length;
        (listRef.current?.querySelector(`[data-nav-index="${nextIndex}"]`) as HTMLElement)?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (index - 1 + flatItems.length) % flatItems.length;
        (listRef.current?.querySelector(`[data-nav-index="${prevIndex}"]`) as HTMLElement)?.focus();
      } else if (event.key === 'Escape' && isMobile) {
        event.preventDefault();
        onToggle();
      }
    },
    [flatItems.length, onNavigate, isMobile, onToggle]
  );

  const handleItemClick = useCallback(
    (route: string) => {
      onNavigate(route);
      if (isMobile) onToggle();
    },
    [onNavigate, isMobile, onToggle]
  );

  const padding = density === 'compact' ? 1 : 1.5;
  const itemPadding = density === 'compact' ? 0.75 : 1.25;
  const itemMinHeight = density === 'compact' ? 40 : 48;

  // Single source of truth for row styling — active / hover / focus all
  // share one visual language, tuned in one place.
  const rowSx = (isActive: boolean) => ({
    borderRadius: 1.5,
    minHeight: itemMinHeight,
    px: itemPadding,
    py: 0.75,
    mb: 0.5,
    bgcolor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
    color: isActive ? theme.palette.primary.main : '#FFFFFF',
    fontWeight: isActive ? 600 : 400,
    transition: 'background-color 0.15s ease, color 0.15s ease',
    '&:hover': {
      bgcolor: isActive ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '& .MuiListItemIcon-root': {
      color: isActive ? theme.palette.primary.main : '#FFFFFF',
      minWidth: 40,
      justifyContent: 'center',
    },
    // Body-sized nav label — matches theme.typography.body1 (0.875rem).
    // `inherit` so fontWeight/color track the row's active state.
    '& .MuiListItemText-primary': {
      fontSize: (t: any) => t.typography.body1.fontSize,
      fontWeight: 'inherit',
      letterSpacing: '0.01em',
      color: 'inherit',
    },
  });

  const renderRow = (
    item: { id: string; label: string; iconName: string; route: string; badge?: string | number | null },
    index: number
  ) => {
    const isActive = activeId === item.id;
    const ItemIcon = getIcon(item.iconName);
    const hasBadge = item.badge !== null && item.badge !== undefined;

    return (
      <ListItemButton
        key={item.id}
        data-nav-index={index}
        onClick={() => handleItemClick(item.route)}
        onKeyDown={(e) => handleKeyDown(e, item.route, index)}
        role="link"
        aria-current={isActive ? 'page' : undefined}
        sx={rowSx(isActive)}
      >
        <ListItemIcon>
          <ItemIcon />
        </ListItemIcon>
        <ListItemText primary={item.label} />
        {hasBadge && (
          <Badge badgeContent={item.badge} color="primary" max={99} sx={{ ml: 'auto', mr: 1 }} />
        )}
      </ListItemButton>
    );
  };

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: TOKENS.sidebar,
        color: TOKENS.sidebarText,
      }}
    >
      {/* Header — logo horizontally centered. No toggle button; the
          sidebar is always open on desktop and dismissed via the mobile
          overlay. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: padding,
          py: padding,
          minHeight: 64,
        }}
      >
        <Box
          onClick={() => handleItemClick(logo?.route || '/')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleItemClick(logo?.route || '/');
            }
          }}
          sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', minWidth: 0 }}
        >
          <TruoyyLogo collapsed={false} size="large" />
        </Box>
      </Box>

      {/* Main navigation */}
      <Box
        component="nav"
        aria-label="Main navigation"
        sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}
      >
        <List ref={listRef} sx={{ px: padding, py: 0 }}>
          {(items || []).map((item, index) => renderRow(item, index))}
        </List>

        {secondary && secondary.length > 0 && (
          <List sx={{ px: padding, py: 0, mt: 2 }}>
            {secondary.map((item, index) =>
              renderRow(item, (items?.length || 0) + index)
            )}
          </List>
        )}
      </Box>

      {/* Profile + logout */}
      <Box sx={{ p: padding }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ListItemButton
            onClick={() => handleItemClick(profile?.route || '/profile')}
            role="link"
            aria-current={activeId === profile?.id ? 'page' : undefined}
            sx={{ ...rowSx(activeId === profile?.id), flex: 1, mb: 0 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Avatar
                src={profile?.avatarUrl}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {!profile?.avatarUrl && getInitials(profile?.label || 'User')}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={profile?.label || 'User'}
              primaryTypographyProps={{
                variant: 'body1',
                sx: { fontWeight: activeId === profile?.id ? 600 : 400 },
              }}
            />
          </ListItemButton>

          <Tooltip title="Logout" placement="top" arrow enterDelay={300}>
            <IconButton
              onClick={logout}
              size="small"
              aria-label="Logout"
              sx={{
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: theme.palette.primary.main,
                },
              }}
            >
              <ExitIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  // Mobile — temporary overlay drawer, opened/closed by AppLayout's
  // hamburger. `collapsed` = closed, `!collapsed` = open.
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={!collapsed}
        onClose={onToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  // Desktop — permanent, always open, fixed width.
  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          border: 'none',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
