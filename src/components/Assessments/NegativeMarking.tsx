import { Box, Typography } from '@mui/material';
import { TOKENS } from '../../theme';
import type { AssessmentQuestion, NegativeAppliesTo } from '../../types/assessment.types';

const TARGETS: Array<{ value: NegativeAppliesTo; label: string }> = [
  { value: 'mcq', label: 'Single correct' },
  { value: 'multi', label: 'Multiple correct' },
  { value: 'both', label: 'Both' },
];

/** Which type the paper's minus is on today: one type only → that type, else both. */
export function appliesToOf(qs: Pick<AssessmentQuestion, 'format' | 'negative_marks'>[]): NegativeAppliesTo {
  const on = (f: string) => qs.some((q) => q.format === f && (q.negative_marks ?? 0) > 0);
  return on('mcq') && !on('multi') ? 'mcq' : on('multi') && !on('mcq') ? 'multi' : 'both';
}

/**
 * "Negative marking on which questions?" + "Minus [x] marks per wrong answer".
 * A bulk setting: saving sets the minus on every question of the picked type(s);
 * each question can still be changed on its own card.
 */
export function NegativeMarking({ value, onValue, appliesTo, onAppliesTo, disabled }: {
  value: string; onValue: (v: string) => void; appliesTo: NegativeAppliesTo; onAppliesTo: (v: NegativeAppliesTo) => void; disabled?: boolean;
}) {
  const n = Number(value);
  const ok = value.trim() !== '' && n >= 0 && n <= 100;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.75 }}>Negative marking on which questions?</Typography>
        {/* Segmented control: one track, the picked part lifts out. */}
        <Box role="radiogroup" aria-label="Negative marking on which questions" sx={{ display: 'inline-flex', p: 0.5, gap: 0.5, borderRadius: '10px', bgcolor: TOKENS.borderLight, maxWidth: '100%', flexWrap: 'wrap' }}>
          {TARGETS.map((t) => {
            const on = t.value === appliesTo;
            return (
              <Box key={t.value} component="button" type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onAppliesTo(t.value)}
                sx={{
                  all: 'unset', cursor: disabled ? 'default' : 'pointer', px: 1.75, py: 0.75, borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                  bgcolor: on ? '#fff' : 'transparent', color: on ? TOKENS.textPrimary : TOKENS.textSecondary, boxShadow: on ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'background-color 0.15s, color 0.15s', opacity: disabled ? 0.6 : 1,
                  '&:hover': { color: TOKENS.textPrimary }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 1 },
                }}>
                {t.label}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem', color: TOKENS.textSecondary }}>
          <Box component="span" sx={{ fontWeight: 700, color: n > 0 ? '#B91C1C' : TOKENS.textMuted, fontSize: '1rem' }} aria-hidden>−</Box>
          <Box component="input" value={value} disabled={disabled} inputMode="decimal" aria-label="Marks lost per wrong answer"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValue(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
            sx={{ width: 64, height: 36, boxSizing: 'border-box', textAlign: 'center', font: 'inherit', fontWeight: 700, color: TOKENS.textPrimary, bgcolor: '#fff', border: `1px solid ${ok ? TOKENS.border : '#B91C1C'}`, borderRadius: '8px', '&:focus': { outline: 'none', borderColor: TOKENS.brand } }} />
          <span>marks per wrong answer</span>
        </Box>
        {!ok && <Typography sx={{ fontSize: '0.78rem', color: '#B91C1C', mt: 0.75 }}>A number from 0 to 100.</Typography>}
      </Box>
    </Box>
  );
}
