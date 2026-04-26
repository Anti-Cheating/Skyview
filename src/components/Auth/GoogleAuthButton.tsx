/**
 * GoogleAuthButton — wraps @react-oauth/google's GoogleLogin so the
 * Login + Signup pages share one button with consistent error handling
 * and post-success routing.
 *
 * The Google button auto-hides if VITE_GOOGLE_CLIENT_ID is unset so a
 * misconfigured env doesn't dead-end the user on a button that opens
 * a broken popup.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Box, Alert } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { TOKENS } from '../../theme';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

interface GoogleAuthButtonProps {
  /** Visual cue only — the same endpoint handles signin and signup. */
  mode: 'signin' | 'signup';
  onError?: (msg: string) => void;
}

export function GoogleAuthButton({ mode, onError }: GoogleAuthButtonProps) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!GOOGLE_CLIENT_ID) return null;

  const reportError = (msg: string) => {
    setLocalError(msg);
    onError?.(msg);
  };

  return (
    <Box>
      {/* Divider above — keeps the email/password form as the primary
          action while making Google obviously equivalent. */}
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

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          opacity: submitting ? 0.6 : 1,
          pointerEvents: submitting ? 'none' : 'auto',
        }}
      >
        <GoogleLogin
          text={mode === 'signup' ? 'signup_with' : 'signin_with'}
          width={372}
          shape="rectangular"
          theme="outline"
          onSuccess={async (cred) => {
            const idToken = cred.credential;
            if (!idToken) {
              reportError('No credential returned from Google');
              return;
            }
            setSubmitting(true);
            setLocalError('');
            try {
              const { requiresOnboarding } = await googleLogin(idToken);
              if (requiresOnboarding) {
                navigate('/onboarding/workspace', { replace: true });
              }
              // Else AuthRoute (above the route this component renders
              // under) will see isAuthenticated flip and redirect to
              // dashboard automatically. No explicit navigate needed.
            } catch (err: any) {
              reportError(
                err?.data?.error ||
                  err?.message ||
                  'Google sign-in failed. Please try again.',
              );
            } finally {
              setSubmitting(false);
            }
          }}
          onError={() => reportError('Google sign-in was cancelled or failed.')}
        />
      </Box>
    </Box>
  );
}
