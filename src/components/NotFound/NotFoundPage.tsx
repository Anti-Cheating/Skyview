/**
 * NotFoundPage — 404 catch-all.
 *
 * Mounted twice in App.tsx:
 *   1. As a nested child of AppLayout, so authenticated users hitting a
 *      bad URL still see the sidebar + nav and can click their way back
 *      without losing context.
 *   2. As a top-level fallback, so unauthenticated visitors with a typo
 *      get a useful page instead of being silently bounced to /login.
 *
 * The CTA flexes by auth state — "Back to Dashboard" for signed-in
 * users, "Go to Login" for everyone else. Same component either way.
 */

import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { SearchOff as SearchOffIcon } from '@mui/icons-material';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const ctaLabel = isAuthenticated ? 'Back to dashboard' : 'Go to login';
  const ctaTarget = isAuthenticated ? '/' : '/login';

  return (
    <Box
      sx={{
        // Fill available height so the empty-state feels intentional —
        // not a tiny block stranded at the top of a giant viewport.
        // minHeight handles both the AppLayout-nested case (where the
        // outlet has bounded height) and the standalone case.
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: { xs: 3, md: 6 },
      }}
    >
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          bgcolor: 'rgba(76, 217, 100, 0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <SearchOffIcon sx={{ fontSize: 48, color: TOKENS.brand }} />
      </Box>

      <Typography
        component="h1"
        sx={{
          m: 0,
          fontSize: { xs: '2.5rem', md: '3rem' },
          fontWeight: 700,
          color: TOKENS.textPrimary,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          mb: 1.5,
        }}
      >
        404
      </Typography>

      <Typography
        component="h2"
        sx={{
          m: 0,
          fontSize: { xs: '1.125rem', md: '1.25rem' },
          fontWeight: 600,
          color: TOKENS.textPrimary,
          mb: 1,
        }}
      >
        Page not found
      </Typography>

      <Typography
        sx={{
          fontSize: '0.9375rem',
          color: TOKENS.textSecondary,
          maxWidth: 420,
          lineHeight: 1.6,
          mb: 4,
        }}
      >
        The page you're looking for doesn't exist or may have moved.
      </Typography>

      <ActionButton onClick={() => navigate(ctaTarget)}>
        {ctaLabel}
      </ActionButton>
    </Box>
  );
}
