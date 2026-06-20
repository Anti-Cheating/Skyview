/**
 * Material-UI Theme Configuration — Truoyy (Skyview)
 * Light content + dark sidebar — mirrors Falcon design system.
 *
 * Color Palette:
 * --bg-main: #F8F9FA (Light gray background)
 * --bg-card: #FFFFFF (White cards)
 * --sidebar-bg: #0B1A10 (Dark green-tinted sidebar)
 * --border-light: #E5E7EB
 * --text-primary: #1F2937
 * --text-secondary: #6B7280
 * --accent: #4CD964 (Truoyy brand green)
 */

import { createTheme } from '@mui/material/styles';

// ── Centralized design tokens ────────────────────────────────────────
// Every component should reference these via theme.palette.* or the
// TOKENS export — never hardcode hex values inline.
export const TOKENS = {
  // Brand
  brand: '#4CD964',
  brandHover: '#3CB853',
  brandLight: '#6DE884',
  brandBg: 'rgba(76, 217, 100, 0.12)',
  // brandText: legacy alias retained so existing imports don't break.
  // Per design direction, inline links should match the button green
  // (#4CD964) rather than a darkened variant — keep the alias mapped to
  // TOKENS.brand and rely on `text-decoration: underline` for the
  // accessibility hook on links.
  brandText: '#4CD964',

  // Sidebar / dark chrome
  sidebar: '#0B1A10',
  sidebarHover: '#142A1A',
  sidebarText: '#FFFFFF',

  // Content / light chrome
  bg: '#F8F9FA',
  bgCard: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Status
  success: '#059669',
  // Softer red than red-600 (#DC2626) — reads clearly as "error" without
  // feeling like a critical alarm. Used by the snackbar, filled Alerts,
  // error buttons, and any TOKENS.error consumer.
  error: '#EF4444',
  errorLight: '#F87171',
  warning: '#FACC15',
} as const;

const colors = {
  primary: {
    main: TOKENS.brand,
    light: TOKENS.brandLight,
    dark: TOKENS.brandHover,
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: TOKENS.brand,
    light: TOKENS.brandLight,
    dark: TOKENS.brandHover,
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#4ADE80',
    light: '#6AE8A0',
    dark: '#3ACE70',
  },
  warning: {
    main: TOKENS.warning,
    light: '#FBDC45',
    dark: '#D9BC05',
  },
  error: {
    // `main` matches TOKENS.error so every MUI error surface (filled
    // Alerts, Buttons color="error", IconButtons, chips) shares the
    // same canonical red used by the snackbar.
    main: TOKENS.error,
    light: TOKENS.errorLight,
    dark: '#B91C1C',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },
  background: {
    default: TOKENS.bg,
    paper: TOKENS.bgCard,
  },
  text: {
    primary: TOKENS.textPrimary,
    secondary: TOKENS.textSecondary,
    disabled: TOKENS.textMuted,
  },
  divider: TOKENS.border,
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    ...colors,
  },
  // ── Typography scale ─────────────────────────────────────────────
  // Tuned for a dense SaaS dashboard, not a marketing page. Defaults are
  // intentionally smaller than MUI's out-of-the-box sizes because every
  // component in Skyview was hardcoding values like 1.05rem / 0.875rem
  // anyway — this scale just codifies what the app actually uses.
  //
  // Canonical roles (use the semantic wrappers in
  // components/layout/Typography.tsx, or fall back to variant= on MUI's
  // Typography):
  //
  //   Page title      → variant="h1"  (1.5rem / 700)
  //   Section heading → variant="h2"  (1.25rem / 600)
  //   Card title      → variant="h3"  (1rem / 600)
  //   Subsection      → variant="h4"  (0.875rem / 600)
  //   Microsection    → variant="h5"  (0.813rem / 600)
  //   (unused)        → variant="h6"
  //   Body            → variant="body1"   (0.875rem / 400)
  //   Secondary text  → variant="body2"   (0.75rem / 400)
  //   Caption / meta  → variant="caption" (0.688rem / 500)
  //   Overline / tag  → variant="overline" (0.625rem / 600 tracked)
  //
  // Anything outside this list should be justified in a comment on the
  // component — ad-hoc fontSize in sx is the thing we're trying to kill.
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700, fontSize: '1.5rem',  lineHeight: 1.25, letterSpacing: '-0.01em' },
    h2: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3 },
    h3: { fontWeight: 600, fontSize: '1rem',    lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '0.813rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '0.75rem',  lineHeight: 1.4 },
    body1:   { fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.6 },
    body2:   { fontWeight: 400, fontSize: '0.75rem',  lineHeight: 1.55 },
    caption: { fontWeight: 500, fontSize: '0.688rem', lineHeight: 1.4 },
    overline:{ fontWeight: 600, fontSize: '0.625rem', lineHeight: 1.4, letterSpacing: '0.05em', textTransform: 'uppercase' },
    button:  { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    '0 4px 12px rgba(0, 0, 0, 0.1)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none',
    'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px !important',
          padding: '8px 16px',
          fontWeight: 500,
          textTransform: 'none',
        },
        contained: {
          backgroundColor: TOKENS.brand,
          color: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(76, 217, 100, 0.2)',
          '&:hover': {
            backgroundColor: TOKENS.brandLight,
            boxShadow: '0 4px 8px rgba(76, 217, 100, 0.3)',
          },
          '&:disabled': {
            backgroundColor: TOKENS.border,
            color: TOKENS.textMuted,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px !important',
          backgroundColor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '12px !important',
          backgroundColor: TOKENS.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${TOKENS.border}`,
          overflow: 'hidden',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
          background: TOKENS.brand,
          borderRadius: '0 !important',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '6px !important',
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px !important',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '0 !important',
          backgroundColor: TOKENS.sidebar,
          color: TOKENS.sidebarText,
          border: 'none',
        },
      },
    },
  },
});
