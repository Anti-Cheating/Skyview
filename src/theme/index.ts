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

const colors = {
  primary: {
    main: '#4CD964',
    light: '#6DE884',
    dark: '#3BB954',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#4CD964',
    light: '#6DE884',
    dark: '#3BB954',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#4ADE80',
    light: '#6AE8A0',
    dark: '#3ACE70',
  },
  warning: {
    main: '#FACC15',
    light: '#FBDC45',
    dark: '#D9BC05',
  },
  error: {
    main: '#F87171',
    light: '#F89191',
    dark: '#D85151',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },
  background: {
    default: '#F8F9FA',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
  },
  divider: '#E5E7EB',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    ...colors,
  },
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
    h1: { fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.2 },
    h2: { fontWeight: 700, fontSize: '2rem', lineHeight: 1.3 },
    h3: { fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.5 },
    h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.813rem', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 500 },
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
          backgroundColor: '#4CD964',
          color: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(76, 217, 100, 0.2)',
          '&:hover': {
            backgroundColor: '#6DE884',
            boxShadow: '0 4px 8px rgba(76, 217, 100, 0.3)',
          },
          '&:disabled': {
            backgroundColor: '#E5E7EB',
            color: '#9CA3AF',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px !important',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '12px !important',
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
          border: '1px solid #E5E7EB',
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
          background: '#4CD964',
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
          backgroundColor: '#0B1A10',
          color: '#FFFFFF',
          border: 'none',
        },
      },
    },
  },
});
