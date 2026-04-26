/**
 * VerifyEmail — /verify-email?token=...
 *
 * Lands here when a new user clicks the link in the verification
 * email. Three render states:
 *   1. verifying — initial spinner while we POST the token
 *   2. success — user is now verified AND signed in (server returns
 *      tokens with the verify response). Auto-redirect to /
 *   3. error — token expired / invalid / used. Offer Resend path.
 *
 * The verify-then-auto-login behaviour saves a step: by the time the
 * user clicks the link they've already proven they own the email and
 * are on a trusted device, so a second "now sign in" gate adds
 * friction with no security benefit.
 */

import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { AuthService } from '../../services/auth.service';
import { useAuth } from '../../contexts/AuthContext';
import { AuthCard } from '../common/AuthCard';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  // Verify tokens are single-use, but React 18 Strict Mode runs effects
  // twice in dev. Without this guard the second run POSTs the same
  // (already-consumed) token and we'd flip a successful verify into an
  // error state. The ref persists across the dev double-invoke.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Verification link is missing or malformed.');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        await AuthService.verifyEmail(token);
        // Tokens are now stored. Pull the user into AuthContext so
        // anything reading `user` re-renders and the post-verify
        // redirect lands them logged in.
        await refreshAuth();
        setStatus('success');
        // Brief hold so the success state registers, then redirect.
        setTimeout(() => navigate('/', { replace: true }), 1500);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err?.message || 'This verification link is no longer valid.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'verifying') {
    return (
      <AuthCard maxWidth={420}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 4 }}>
          <CircularProgress sx={{ color: TOKENS.brand, mb: 2 }} />
          <Box sx={{ fontSize: '0.9375rem', color: TOKENS.textSecondary }}>
            Verifying your email…
          </Box>
        </Box>
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard maxWidth={420}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: `${TOKENS.brand}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 40, color: TOKENS.brand }} />
          </Box>
          <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', mb: 0.75 }}>
            Email verified
          </Box>
          <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary }}>
            Signing you in…
          </Box>
        </Box>
      </AuthCard>
    );
  }

  // error
  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <ErrorIcon sx={{ fontSize: 40, color: '#B91C1C' }} />
        </Box>
        <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', mb: 0.75 }}>
          Link no longer valid
        </Box>
      </Box>

      <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', py: 0.5 }}>
        {errorMsg}
      </Alert>

      <ActionButton
        fullWidth
        onClick={() => navigate('/login')}
      >
        Go to sign in
      </ActionButton>

      <Box sx={{ textAlign: 'center', mt: 2.5, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Need a new link?{' '}
        <Link
          component={RouterLink}
          to="/check-inbox"
          sx={{
            color: TOKENS.brand,
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { opacity: 0.75 },
          }}
        >
          Resend
        </Link>
      </Box>
    </AuthCard>
  );
}
