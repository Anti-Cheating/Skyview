/**
 * GoogleAuthButton — custom-styled "Continue with Google" button.
 *
 * We render our own button (matching ActionButton "secondary" — same
 * 8px radius / full-width / padding as the email/password submit) and
 * trigger Google's popup via `useGoogleLogin` from @react-oauth/google.
 *
 * Why not <GoogleLogin>: that component renders an iframe-hosted button
 * whose CSS we can't override, so its corner radius / width / padding
 * never match the rest of the form. The implicit popup flow returns
 * an access token; the backend POSTs it to Google's userinfo endpoint
 * to get the same claim set an ID token would yield.
 *
 * Auto-hides if VITE_GOOGLE_CLIENT_ID isn't configured.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Box, Alert } from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import { useAuth } from '../../contexts/AuthContext';
import { TOKENS } from '../../theme';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

interface GoogleAuthButtonProps {
  /** Visual cue only — the same backend endpoint handles signin and signup. */
  mode: 'signin' | 'signup';
  onError?: (msg: string) => void;
}

// Inline G-logo SVG so we don't pull a separate icon dep just for one use.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7964 2.7164v2.2581h2.9087c1.7018-1.5668 2.6841-3.8741 2.6841-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8595-3.0477.8595-2.344 0-4.3282-1.5832-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9979 8.9979 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.9636 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleAuthButton({ mode, onError }: GoogleAuthButtonProps) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const reportError = (msg: string) => {
    setLocalError(msg);
    onError?.(msg);
  };

  // Implicit popup flow → access token. The hook returns a function;
  // calling it opens Google's popup. On success we forward the token
  // to our backend, which calls Google's userinfo endpoint to verify
  // the identity (same claim set we'd get from an ID token).
  const triggerLogin = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: async (resp) => {
      const accessToken = resp.access_token;
      if (!accessToken) {
        reportError('No access token returned from Google');
        return;
      }
      setSubmitting(true);
      setLocalError('');
      try {
        const { requiresOnboarding } = await googleLogin(accessToken);
        if (requiresOnboarding) {
          navigate('/onboarding/workspace', { replace: true });
        }
        // Else AuthRoute redirects automatically once isAuthenticated flips.
      } catch (err: any) {
        reportError(
          err?.data?.error ||
            err?.message ||
            'Google sign-in failed. Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => reportError('Google sign-in was cancelled or failed.'),
  });

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <Box>
      {/* "OR" divider — same shape regardless of GOOGLE_CLIENT_ID
          presence above (component already early-returns null). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 2,
          gap: 1.25,
          color: TOKENS.textSecondary,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Box sx={{ flex: 1, height: '1px', bgcolor: TOKENS.border }} />
        or
        <Box sx={{ flex: 1, height: '1px', bgcolor: TOKENS.border }} />
      </Box>

      {localError && (
        <Alert severity="error" sx={{ mb: 1.5, borderRadius: '10px', py: 0.5 }}>
          {localError}
        </Alert>
      )}

      <ActionButton
        variant="secondary"
        fullWidth
        loading={submitting}
        disabled={submitting}
        onClick={() => triggerLogin()}
        startIcon={<GoogleIcon />}
      >
        {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
      </ActionButton>
    </Box>
  );
}
