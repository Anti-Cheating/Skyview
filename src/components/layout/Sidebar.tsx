import React, { useEffect, useRef, useCallback } from 'react';
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
  PieChart as PieChartIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  ReceiptLong as ReceiptLongIcon,
  BarChart as BarChartIcon,
  CreditCard as CreditCardIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  Person as PersonIcon,
  Mic as MicIcon,
  Monitor as MonitorIcon,
  CameraAlt as CameraIcon,
  ExitToApp as ExitIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { SidebarProps } from './sidebar.types';
import { TruoyyLogo } from './TruoyyLogo';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';

const iconMap: Record<string, React.ComponentType<any>> = {
  Dashboard: DashboardIcon,
  PieChart: PieChartIcon,
  TrendingUp: TrendingUpIcon,
  AccountBalanceWallet: AccountBalanceWalletIcon,
  ReceiptLong: ReceiptLongIcon,
  BarChart: BarChartIcon,
  CreditCard: CreditCardIcon,
  Settings: SettingsIcon,
  HelpOutline: HelpOutlineIcon,
  Person: PersonIcon,
  Mic: MicIcon,
  Monitor: MonitorIcon,
  Camera: CameraIcon,
  ExitToApp: ExitIcon,
  VideoCall: VideoCallIcon,
  Interviews: VideoCallIcon,
};

const getInitials = (label: string): string => {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return label.substring(0, 2).toUpperCase() || 'U';
};

const getIcon = (iconName: string): React.ComponentType<any> => {
  return iconMap[iconName] || DashboardIcon;
};

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
  collapsedWidth = 72,
  density = 'comfortable',
}: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout } = useAuth();
  const listRef = useRef<HTMLUListElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
    } catch (error) {
      console.warn('Failed to persist sidebar state:', error);
    }
  }, [collapsed]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, _itemId: string, route: string, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate(route);
        if (isMobile) onToggle();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = index + 1;
        const allItems = [...(items || []), ...(secondary || [])];
        if (nextIndex < allItems.length) {
          focusedIndexRef.current = nextIndex;
          const nextButton = listRef.current?.querySelector(
            `[data-nav-index="${nextIndex}"]`
          ) as HTMLElement;
          nextButton?.focus();
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = index - 1;
        if (prevIndex >= 0) {
          focusedIndexRef.current = prevIndex;
          const prevButton = listRef.current?.querySelector(
            `[data-nav-index="${prevIndex}"]`
          ) as HTMLElement;
          prevButton?.focus();
        }
      } else if (event.key === 'Escape' && isMobile) {
        event.preventDefault();
        onToggle();
      }
    },
    [items, secondary, onNavigate, isMobile, onToggle]
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
      {/* Logo Section */}
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
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center',
          }}
          onClick={() => handleItemClick(logo?.route || '/')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleItemClick(logo?.route || '/');
            }
          }}
        >
          <TruoyyLogo collapsed={collapsed} size={collapsed ? 'small' : 'large'} />
        </Box>
      </Box>

      {/* Main Navigation Items */}
      <Box
        component="nav"
        aria-label="Main navigation"
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 1,
        }}
      >
        <List ref={listRef} sx={{ px: padding, py: 0 }}>
          {(items || []).map((item, index) => {
            const isActive = activeId === item.id;
            const ItemIcon = getIcon(item.iconName);
            const hasBadge = item.badge !== null && item.badge !== undefined;

            const listItem = (
              <ListItemButton
                key={item.id}
                data-nav-index={index}
                onClick={() => handleItemClick(item.route)}
                onKeyDown={(e) => handleKeyDown(e, item.id, item.route, index)}
                role="link"
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  borderRadius: 1.5,
                  minHeight: itemMinHeight,
                  px: itemPadding,
                  py: 0.75,
                  mb: 0.5,
                  bgcolor: 'transparent',
                  color: isActive ? theme.palette.primary.main : '#FFFFFF',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  '&:hover': { bgcolor: 'transparent' },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                  '& .MuiListItemIcon-root': {
                    color: isActive ? theme.palette.primary.main : '#FFFFFF',
                    minWidth: collapsed ? 'auto' : 40,
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                  },
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: 'inherit',
                    letterSpacing: '0.01em',
                    color: 'inherit',
                  },
                }}
              >
                <ListItemIcon>
                  {hasBadge ? (
                    <Badge
                      badgeContent={item.badge}
                      color="primary"
                      max={99}
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.625rem',
                          height: 18,
                          minWidth: 18,
                          padding: '0 4px',
                        },
                      }}
                    >
                      <ItemIcon />
                    </Badge>
                  ) : (
                    <ItemIcon />
                  )}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    secondary={
                      hasBadge && typeof item.badge === 'string' && item.badge.length > 10
                        ? item.badge
                        : undefined
                    }
                  />
                )}
                {!collapsed && hasBadge && typeof item.badge === 'string' && item.badge.length <= 10 && (
                  <Badge
                    badgeContent={item.badge}
                    color="primary"
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        fontSize: '0.625rem',
                        height: 18,
                        minWidth: 18,
                        padding: '0 4px',
                      },
                    }}
                  />
                )}
              </ListItemButton>
            );

            if (collapsed) {
              return (
                <Tooltip
                  key={item.id}
                  title={item.label + (item.badge ? ` (${item.badge})` : '')}
                  placement="right"
                  arrow
                  enterDelay={300}
                  leaveDelay={0}
                >
                  {listItem}
                </Tooltip>
              );
            }

            return listItem;
          })}
        </List>

        {/* Secondary Navigation Items */}
        <List sx={{ px: padding, py: 0 }}>
          {(secondary || []).map((item, index) => {
            const isActive = activeId === item.id;
            const ItemIcon = getIcon(item.iconName);
            const actualIndex = items.length + index;

            const listItem = (
              <ListItemButton
                key={item.id}
                data-nav-index={actualIndex}
                onClick={() => handleItemClick(item.route)}
                onKeyDown={(e) => handleKeyDown(e, item.id, item.route, actualIndex)}
                role="link"
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  borderRadius: 1.5,
                  minHeight: itemMinHeight,
                  px: itemPadding,
                  py: 0.75,
                  mb: 0.5,
                  bgcolor: 'transparent',
                  color: isActive ? theme.palette.primary.main : '#FFFFFF',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  '&:hover': { bgcolor: 'transparent' },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                  '& .MuiListItemIcon-root': {
                    color: isActive ? theme.palette.primary.main : '#FFFFFF',
                    minWidth: collapsed ? 'auto' : 40,
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                  },
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: 'inherit',
                    letterSpacing: '0.01em',
                    color: 'inherit',
                  },
                }}
              >
                <ListItemIcon>
                  <ItemIcon />
                </ListItemIcon>
                {!collapsed && <ListItemText primary={item.label} />}
              </ListItemButton>
            );

            if (collapsed) {
              return (
                <Tooltip
                  key={item.id}
                  title={item.label}
                  placement="right"
                  arrow
                  enterDelay={300}
                  leaveDelay={0}
                >
                  {listItem}
                </Tooltip>
              );
            }

            return listItem;
          })}
        </List>
      </Box>

      {/* Profile Section */}
      <Box sx={{ p: padding }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip
            title={collapsed ? (profile?.label || 'Profile') : ''}
            placement="right"
            arrow
            enterDelay={300}
            leaveDelay={0}
          >
            <ListItemButton
              onClick={() => handleItemClick(profile?.route || '/profile')}
              role="link"
              aria-current={activeId === profile?.id ? 'page' : undefined}
              sx={{
                borderRadius: 1.5,
                minHeight: itemMinHeight,
                px: itemPadding,
                py: 0.75,
                flex: 1,
                bgcolor: activeId === profile?.id ? TOKENS.sidebarHover : 'transparent',
                color: '#FFFFFF',
                transition: 'all 0.2s ease',
                justifyContent: collapsed ? 'center' : 'flex-start',
                '&:hover': { bgcolor: TOKENS.sidebarHover },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 40 }}>
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
              {!collapsed && (
                <ListItemText
                  primary={profile?.label || 'User'}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: activeId === profile?.id ? 600 : 400,
                  }}
                />
              )}
            </ListItemButton>
          </Tooltip>

          {!collapsed && (
            <Tooltip
              title="Logout"
              placement="right"
              arrow
              enterDelay={300}
              leaveDelay={0}
            >
              <IconButton
                onClick={logout}
                size="small"
                sx={{
                  color: '#FFFFFF',
                  '&:hover': {
                    bgcolor: TOKENS.sidebarHover,
                    color: theme.palette.primary.main,
                  },
                }}
              >
                <ExitIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );

  // Skyview: sidebar is always permanent and always open (no mobile temporary drawer)
  return (
    <Drawer
      variant="permanent"
      open={!collapsed}
      sx={{
        width: collapsed ? collapsedWidth : width,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        '& .MuiDrawer-paper': {
          width: collapsed ? collapsedWidth : width,
          boxSizing: 'border-box',
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
          border: 'none',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
