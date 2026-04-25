/**
 * StatusDot — small dot + label primitive for lifecycle status columns.
 *
 * Used by the interview list and any future "session/job/run" tables
 * that need to convey state at row scale. Cleaner than a full Chip in a
 * dense table: one colored circle + one short word, no chip border or
 * background to compete with the row's hover tint.
 *
 * Active gets a subtle pulse — it's the one state where "happening
 * right now" deserves emphasis. Everything else is static.
 */

import { Box, Typography } from '@mui/material';

export type SessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'ENDED'
  | 'CANCELLED'
  | string;

const STATUS_TOKENS: Record<
  string,
  { dot: string; label: string; pulse?: boolean }
> = {
  SCHEDULED: { dot: '#9CA3AF', label: '#374151' },
  ACTIVE:    { dot: '#4CD964', label: '#047857', pulse: true },
  ENDED:     { dot: '#2E7D32', label: '#374151' },
  CANCELLED: { dot: '#EF4444', label: '#374151' },
};

function prettyLabel(s: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function StatusDot({ status }: { status: SessionStatus }) {
  const tokens = STATUS_TOKENS[status] ?? STATUS_TOKENS.SCHEDULED;
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: tokens.dot,
          flexShrink: 0,
          ...(tokens.pulse
            ? {
                boxShadow: `0 0 0 0 ${tokens.dot}`,
                animation: 'statusDotPulse 1.6s ease-out infinite',
                '@keyframes statusDotPulse': {
                  '0%':   { boxShadow: `0 0 0 0 rgba(76, 217, 100, 0.45)` },
                  '70%':  { boxShadow: `0 0 0 6px rgba(76, 217, 100, 0)` },
                  '100%': { boxShadow: `0 0 0 0 rgba(76, 217, 100, 0)` },
                },
              }
            : null),
        }}
      />
      <Typography
        component="span"
        sx={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: tokens.label,
          lineHeight: 1,
        }}
      >
        {prettyLabel(status)}
      </Typography>
    </Box>
  );
}
