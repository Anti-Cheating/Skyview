/**
 * AuthCard — centered white card with the Trueyy logo at the top, used
 * by every full-page auth flow (Login, Signup, InviteAccept, and future
 * password-reset / magic-link views).
 *
 *   <AuthCard>
 *     ...form fields...
 *     <ActionButton fullWidth>Submit</ActionButton>
 *   </AuthCard>
 *
 * The outer <Shell> fills the viewport with the light bg and centers the
 * card. The card itself is the 16px-radius white paper that Signup/Signin
 * and Invite all share — pick it up here instead of re-declaring `p`,
 * `borderRadius`, `boxShadow` on every auth page.
 */

import { Box, Paper } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { TruoyyLogo } from '../layout/TruoyyLogo';
import { TOKENS } from '../../theme';

export interface AuthCardProps {
  children: React.ReactNode;
  /** Max width of the card in pixels (default 460). */
  maxWidth?: number;
  /** Hide the logo — for error/confirmation variants that render their own. */
  hideLogo?: boolean;
  /** Extra sx applied to the inner Paper, not the outer Shell. */
  cardSx?: SxProps<Theme>;
}

export function AuthCard({ children, maxWidth = 460, hideLogo = false, cardSx }: AuthCardProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: TOKENS.bg,
        p: 2,
        py: 5,
      }}
    >
      <Paper
        variant="outlined"
        sx={[
          {
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth,
            borderRadius: '16px !important',
            borderColor: TOKENS.border,
            bgcolor: TOKENS.bgCard,
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          },
          ...(Array.isArray(cardSx) ? cardSx : cardSx ? [cardSx] : []),
        ]}
      >
        {!hideLogo && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <TruoyyLogo collapsed={false} size="large" variant="dark" />
          </Box>
        )}
        {children}
      </Paper>
    </Box>
  );
}
