/**
 * StepRow — shared vertical-stepper row used by CandidateJoinPage and
 * InterviewerSetupCard. Renders a numbered badge (or ✓ when done),
 * icon, title, and optional body content. Done rows get a green tint,
 * active rows are white, future rows are dimmed.
 */

import { Box, Typography } from '@mui/material';
import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';

const BRAND = TOKENS.brand;
const BORDER = TOKENS.border;

const ROW_BG_DONE = 'rgba(76, 217, 100, 0.06)';
const ROW_BG_ACTIVE = '#FFFFFF';
const ROW_BG_PENDING = '#FAFAFA';

export interface StepRowProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  done: boolean;
  active: boolean;
  first?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}

export default function StepRow({
  number,
  icon,
  title,
  done,
  active,
  first,
  last,
  children,
}: StepRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 2.5,
        py: 2,
        bgcolor: done ? ROW_BG_DONE : active ? ROW_BG_ACTIVE : ROW_BG_PENDING,
        borderBottom: last ? 'none' : `1px solid ${BORDER}`,
        borderRadius:
          first && last ? '12px' : first ? '12px 12px 0 0' : last ? '0 0 12px 12px' : 0,
        opacity: !active && !done ? 0.45 : 1,
        transition: 'background 0.2s, opacity 0.2s',
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: done ? BRAND : active ? '#1F2937' : '#D1D5DB',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {done ? <CheckIcon sx={{ fontSize: 16 }} /> : number}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: children ? 0.5 : 0 }}>
          <Box sx={{ color: done ? BRAND : active ? '#1F2937' : '#9CA3AF', display: 'flex' }}>
            {icon}
          </Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: done ? '#065F46' : '#1F2937' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </Box>
    </Box>
  );
}
