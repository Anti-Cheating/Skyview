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
import { motion } from 'framer-motion';
import { SidebarProps } from './sidebar.types';
import { TruoyyLogo } from './TruoyyLogo';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

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
  const { company } = useCompany();
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

  // Single source of truth for row styling. The active *background* is
  // intentionally left transparent here — a framer-motion `layoutId`
  // pill renders behind the active item below and morphs between rows
  // when activeId changes. Active text + icon colour stay; only the
  // fill is owned by the pill.
  const rowSx = (isActive: boolean) => ({
    position: 'relative' as const,
    borderRadius: 1.5,
    minHeight: itemMinHeight,
    px: itemPadding,
    py: 0.75,
    mb: 0.5,
    bgcolor: 'transparent',
    color: isActive ? theme.palette.primary.main : '#FFFFFF',
    fontWeight: isActive ? 600 : 400,
    transition: 'color 0.15s ease',
    '&:hover': {
      bgcolor: isActive ? 'transparent' : 'rgba(255,255,255,0.05)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '& .MuiListItemIcon-root': {
      color: isActive ? theme.palette.primary.main : '#FFFFFF',
      minWidth: 40,
      justifyContent: 'center',
      position: 'relative',
      zIndex: 1,
    },
    // Body-sized nav label — matches theme.typography.body1 (0.875rem).
    // `inherit` so fontWeight/color track the row's active state.
    '& .MuiListItemText-root': {
      position: 'relative',
      zIndex: 1,
    },
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
        {/* Sliding active pill — same `layoutId` across every active
            instance, so framer-motion morphs the rectangle from the
            previous active row to this one when activeId changes.
            Sits at z-index 0 behind the icon + label (which are pushed
            to z-index 1 in rowSx). */}
        {isActive && (
          <motion.div
            layoutId="sidebar-active-pill"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.10)',
              zIndex: 0,
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        )}
        <ListItemIcon>
          <ItemIcon />
        </ListItemIcon>
        <ListItemText primary={item.label} />
        {hasBadge && (
          <Badge badgeContent={item.badge} color="primary" max={99} sx={{ ml: 'auto', mr: 1, position: 'relative', zIndex: 1 }} />
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

      {/* Workspace chip — below the brand, above the nav. Frames the
          nav as "this is the company you're acting in" without
          displacing the Trueyy mark. Renders only when the user
          belongs to a company (candidates have no company_id) and
          lights up softly on hover so it's clearly tappable for the
          /profile flow. */}
      {company && (
        <Box sx={{ px: padding, pb: 1.25 }}>
          <Box
            onClick={() => handleItemClick('/profile')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleItemClick('/profile');
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              transition: 'background-color 120ms ease, border-color 120ms ease',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.12)',
              },
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {company.logo_url ? (
                <img
                  // key forces React to mount a fresh <img> node when
                  // logo_url changes (e.g. on replace) so we never
                  // re-use a cached DOM element pointed at the old src.
                  key={company.logo_url}
                  src={company.logo_url}
                  alt={company.name}
                  style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain' }}
                  draggable={false}
                />
              ) : (
                <Box
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: TOKENS.sidebar,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {getInitials(company.name)}
                </Box>
              )}
            </Box>
            <Box
              sx={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.3,
                minWidth: 0,
                flex: 1,
              }}
            >
              {company.name}
            </Box>
          </Box>
        </Box>
      )}

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

      {/* Profile display + logout. The avatar+name block is intentionally
          passive — clicking it used to navigate to /profile and light up
          as "active", but that duplicates the dedicated Profile nav item
          we added higher up. Keep this slot as a quiet identity badge so
          the user knows who they're signed in as. Logout stays clickable
          on the right. */}
      <Box sx={{ p: padding }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
              px: 1,
              py: 0.75,
            }}
          >
            <Avatar
              src={profile?.avatarUrl}
              // Google's avatar CDN (lh3.googleusercontent.com) returns
              // 403 when the request carries a non-Google referrer. Set
              // no-referrer so Google avatars load reliably; harmless
              // for our own R2 URLs.
              imgProps={{ referrerPolicy: 'no-referrer' }}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
                mr: 1.25,
              }}
            >
              {!profile?.avatarUrl && getInitials(profile?.label || 'User')}
            </Avatar>
            <Box
              sx={{
                fontSize: '0.875rem',
                fontWeight: 400,
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {profile?.label || 'User'}
            </Box>
          </Box>

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
