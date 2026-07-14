import { Box } from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  DesktopWindows as ScreenIcon,
  Mic as MicIcon,
  VolumeUp as AudioIcon,
  Keyboard as KeyboardIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';

interface Props {
  body: string;
  /** Stored on the consent record for evidence; not shown to the candidate. */
  version: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  onAgree: () => void;
  onDecline: () => void;
  busy?: boolean;
}

const BRAND = TOKENS.brand;
const BRAND_BG = TOKENS.brandBg;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

// The four things recorded — branded tiles rather than a text bullet list.
const RECORDED = [
  { icon: <ScreenIcon />, label: 'Screen & open apps', desc: 'Your screen and the titles of applications you have open' },
  { icon: <MicIcon />, label: 'Microphone', desc: 'Your microphone audio during the interview' },
  { icon: <AudioIcon />, label: 'Meeting audio', desc: 'Audio played on your device from the meeting' },
  { icon: <KeyboardIcon />, label: 'Keystroke metrics', desc: 'Timing and paste events — never the content you type' },
];

const ASSURANCES = [
  'Used only to assess interview integrity, shared with the company that invited you',
  'You can withdraw consent at any time — your interviewer is notified and recording stops immediately',
  'Withdrawing does not affect data already recorded; data is kept per the company’s retention policy',
];

/** Consent step body — a card that slots under the page header + stepper.
 *  Renders structured, branded content (recorded-item tiles + assurances).
 *  The `body` prop remains the source of truth for what's stored as
 *  evidence; this is the human-friendly presentation of the same terms. */
export default function ConsentScreen({ companyName, onAgree, onDecline, busy }: Props) {
  return (
    <Box sx={{
      width: 600, maxWidth: '100%', bgcolor: LIGHT_BG,
      borderRadius: '16px', border: `1px solid ${LIGHT_BORDER}`,
      boxShadow: '0 4px 24px rgba(17, 24, 39, 0.06)', overflow: 'hidden',
    }}>
      {/* Card header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 3, md: 4 }, pt: 3, pb: 1 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
          bgcolor: BRAND_BG, color: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <CardTitle component="h2" sx={{ m: 0, fontWeight: 700, color: TOKENS.textPrimary }}>
            Review &amp; agree to monitoring
          </CardTitle>
          <Caption sx={{ color: TOKENS.textSecondary }}>Required before this interview can start</Caption>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 3, md: 4 }, pt: 1.5, pb: 1 }}>
        <Secondary sx={{ color: TOKENS.textSecondary, mb: 2.5 }}>
          {companyName ? `${companyName} uses` : 'This interview uses'} Trueyy integrity
          monitoring. For the duration of this session we will record:
        </Secondary>

        {/* Recorded items — branded tiles */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 3 }}>
          {RECORDED.map((item) => (
            <Box key={item.label} sx={{
              display: 'flex', gap: 1.25, alignItems: 'flex-start',
              p: 1.5, borderRadius: '10px', bgcolor: '#FAFBFC', border: `1px solid ${LIGHT_BORDER}`,
            }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                bgcolor: BRAND_BG, color: BRAND,
                display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 18 },
              }}>
                {item.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Secondary sx={{ fontWeight: 600, color: TOKENS.textPrimary, fontSize: '0.85rem' }}>
                  {item.label}
                </Secondary>
                <Caption sx={{ display: 'block', color: TOKENS.textSecondary, lineHeight: 1.45 }}>
                  {item.desc}
                </Caption>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Assurances — brand check rows */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 1 }}>
          {ASSURANCES.map((line) => (
            <AssuranceRow key={line}>{line}</AssuranceRow>
          ))}
        </Box>
      </Box>

      {/* Footer actions */}
      <Box sx={{
        display: 'flex', gap: 1.25, justifyContent: 'flex-end',
        px: { xs: 3, md: 4 }, py: 2.5, mt: 1,
        borderTop: `1px solid ${LIGHT_BORDER}`, bgcolor: '#FCFCFD',
      }}>
        <ActionButton variant="secondary" onClick={onDecline} disabled={busy}>Decline</ActionButton>
        <ActionButton onClick={onAgree} loading={busy}>Agree &amp; continue</ActionButton>
      </Box>
    </Box>
  );
}

function AssuranceRow({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <CheckIcon sx={{ color: BRAND, fontSize: 17, mt: '1px', flexShrink: 0 }} />
      <Caption sx={{ color: TOKENS.textSecondary, lineHeight: 1.5 }}>{children}</Caption>
    </Box>
  );
}
