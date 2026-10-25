import { useEffect, useState } from 'react';
import { Box, InputBase, Typography } from '@mui/material';
import { TOKENS } from '../../theme';
import type { AssessmentMode } from '../../types/assessment.types';

/** Same limits as the API: a sitting is 5 min to 3 h; an assignment window up to 7 days. */
export const MAX_MIN: Record<AssessmentMode, number> = { live: 180, take_home: 7 * 1440 };
const MIN_MIN = 5;

/** Aptitude: hours + minutes. Assignment: days + hours. */
const UNITS: Record<AssessmentMode, Array<{ label: string; min: number }>> = {
  live: [{ label: 'h', min: 60 }, { label: 'min', min: 1 }],
  take_home: [{ label: 'days', min: 1440 }, { label: 'h', min: 60 }],
};

export const durationError = (mode: AssessmentMode, min: number) =>
  min < MIN_MIN ? 'At least 5 minutes'
    : min > MAX_MIN[mode] ? (mode === 'live' ? 'At most 3 hours' : 'At most 7 days')
      : '';

/**
 * Type any time. `onChange` gets the total in minutes on every keystroke;
 * `onCommit` (optional) fires when focus leaves the group with a valid value.
 */
export function DurationInput({ mode, value, onChange, onCommit, disabled, compact }: {
  mode: AssessmentMode; value: number; onChange?: (min: number) => void; onCommit?: (min: number) => void; disabled?: boolean; compact?: boolean;
}) {
  const [big, small] = UNITS[mode];
  const split = (v: number) => [String(Math.floor(v / big.min)), String(Math.round((v % big.min) / small.min))];
  const [parts, setParts] = useState(() => split(value));
  useEffect(() => setParts(split(value)), [value, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = (p: string[]) => (Number(p[0]) || 0) * big.min + (Number(p[1]) || 0) * small.min;
  const err = durationError(mode, total(parts));
  const set = (i: number, raw: string) => {
    const next = [...parts];
    next[i] = raw.replace(/\D/g, '').slice(0, 3);
    setParts(next);
    onChange?.(total(next));
  };

  return (
    <Box>
      <Box
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          const t = total(parts);
          if (!durationError(mode, t) && t !== value) onCommit?.(t);
          else if (onCommit) setParts(split(value)); // invalid or unchanged: show the saved time again
        }}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        {[big, small].map((u, i) => (
          <Box key={u.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InputBase
              value={parts[i]} disabled={disabled} onChange={(e) => set(i, e.target.value)}
              onFocus={(e) => e.target.select()}
              inputProps={{ inputMode: 'numeric', 'aria-label': u.label === 'h' ? 'Hours' : u.label === 'min' ? 'Minutes' : 'Days' }}
              sx={{
                width: compact ? 40 : 56, height: compact ? 26 : 38, px: 1, borderRadius: '8px', fontSize: compact ? '0.8rem' : '0.95rem', fontWeight: 600,
                border: `1px solid ${err && !onCommit ? TOKENS.error : TOKENS.border}`, bgcolor: '#fff',
                '& input': { textAlign: 'center', p: 0, fontVariantNumeric: 'tabular-nums' },
                '&.Mui-focused': { borderColor: TOKENS.brand },
              }}
            />
            <Typography component="span" sx={{ fontSize: compact ? '0.78rem' : '0.85rem', color: TOKENS.textSecondary }}>{u.label}</Typography>
          </Box>
        ))}
      </Box>
      {err && !onCommit && <Typography role="alert" sx={{ fontSize: '0.75rem', color: TOKENS.error, mt: 0.5 }}>{err}</Typography>}
    </Box>
  );
}
