import { Box } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { Caption } from '../layout/Typography';

const BRAND = TOKENS.brand;
const LIGHT_BORDER = TOKENS.border;

export type JoinStep = 'consent' | 'install' | 'permissions' | 'join';

const STEPS: { key: JoinStep; label: string }[] = [
  { key: 'consent', label: 'Consent' },
  { key: 'install', label: 'Install' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'join', label: 'Join' },
];

/** Horizontal 4-step progress band for the candidate join flow. Sits
 *  directly under the page header. `current` is the active step; every
 *  step before it renders as complete (green check). */
export default function JoinStepper({ current }: { current: JoinStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      px: { xs: 2, md: 3 }, py: 2,
      borderBottom: `1px solid ${LIGHT_BORDER}`, bgcolor: '#FBFCFD',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 520 }}>
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : '0 0 auto' }}>
              {/* Node */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.2s ease',
                  ...(done
                    ? { bgcolor: BRAND, color: '#fff' }
                    : active
                      ? { bgcolor: TOKENS.brandBg, color: BRAND, border: `2px solid ${BRAND}` }
                      : { bgcolor: '#F3F4F6', color: TOKENS.textMuted, border: `2px solid ${LIGHT_BORDER}` }),
                }}>
                  {done ? <CheckIcon sx={{ fontSize: 16 }} /> : i + 1}
                </Box>
                <Caption sx={{
                  fontWeight: active ? 700 : 500,
                  color: done || active ? TOKENS.textPrimary : TOKENS.textMuted,
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </Caption>
              </Box>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <Box sx={{
                  flex: 1, height: 2, mx: 1, mb: 2.25, borderRadius: 1,
                  bgcolor: i < currentIndex ? BRAND : LIGHT_BORDER,
                  transition: 'background-color 0.2s ease',
                }} />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
