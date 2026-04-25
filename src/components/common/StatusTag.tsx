/**
 * StatusTag — antd-style coloured tag (bordered chip with a tinted bg
 * + matching text). Replaces the dot+label `StatusDot`. The antd Tag
 * pattern reads better at a glance in dense tables — the colour bleeds
 * across the whole pill rather than being concentrated on a 6px dot.
 *
 * Each variant uses three values from the same hue:
 *   - bg:    tinted (12-14% opacity over white) → soft fill
 *   - border: 35-45% opacity → defined edge without shouting
 *   - text:  full-strength dark variant → readable
 *
 * Tokens are kept inline (not in theme) because they're tied to the
 * component's visual treatment, not to brand colour usage elsewhere.
 */

import { Box } from '@mui/material';

export type SessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'ENDED'
  | 'CANCELLED'
  | string;

interface TagTokens {
  bg: string;
  border: string;
  text: string;
  label?: string;
}

const STATUS_TOKENS: Record<string, TagTokens> = {
  SCHEDULED: {
    bg:     '#F3F4F6',
    border: '#D1D5DB',
    text:   '#374151',
  },
  ACTIVE: {
    // Brand green — the only state that shouts. "Happening right now"
    // earns the eye-catch.
    bg:     'rgba(76, 217, 100, 0.14)',
    border: 'rgba(76, 217, 100, 0.45)',
    text:   '#047857',
  },
  ENDED: {
    bg:     '#ECFDF5',
    border: '#A7F3D0',
    text:   '#065F46',
  },
  CANCELLED: {
    bg:     '#FEF2F2',
    border: '#FECACA',
    text:   '#B91C1C',
  },
};

function prettyLabel(s: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function StatusTag({ status }: { status: SessionStatus }) {
  const tokens = STATUS_TOKENS[status] ?? STATUS_TOKENS.SCHEDULED;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 0.875,
        borderRadius: '4px',
        bgcolor: tokens.bg,
        border: `1px solid ${tokens.border}`,
        color: tokens.text,
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {prettyLabel(status)}
    </Box>
  );
}
