/**
 * CheckInbox — /check-inbox?email=...
 *
 * Where new signups land after submitting the form. The signup
 * endpoint creates the user but does NOT issue tokens; the only way
 * forward is to click the link in the verification email. This page
 * tells the user where to look and offers a Resend button if the
 * email never arrives.
 *
 * Mirrors the ForgotPassword "Check your inbox" success card so users
 * who've seen the password-reset flow recognize the pattern.
 */

import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Alert,
  Link,
} from '@mui/material';
import { MarkEmailRead as MarkEmailReadIcon } from '@mui/icons-material';
import { AuthService } from '../../services/auth.service';
import { AuthCard } from '../common/AuthCard';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

export default function CheckInbox() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';

  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!email) return;
    setError('');
    setResending(true);
    try {
      await AuthService.resendVerification(email);
      setResentMsg('Verification email sent — check your inbox.');
    } catch (err: any) {
      setError(err?.message || 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
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
          <MarkEmailReadIcon sx={{ fontSize: 36, color: TOKENS.brand }} />
        </Box>
        <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.25, mb: 0.75 }}>
          Verify your email
        </Box>
        <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary, lineHeight: 1.5 }}>
          We sent a verification link to
        </Box>
        {email && (
          <Box sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary, mt: 0.5 }}>
            {email}
          </Box>
        )}
        <Box sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary, mt: 1.5 }}>
          Click the link in the email to activate your account and sign in.
        </Box>
      </Box>

      {resentMsg && !error && (
        <Alert severity="success" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {resentMsg}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {error}
        </Alert>
      )}

      <ActionButton
        fullWidth
        onClick={handleResend}
        loading={resending}
        disabled={resending || !email}
      >
        Resend verification email
      </ActionButton>

      <Box sx={{ textAlign: 'center', mt: 2.5, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Wrong email?{' '}
        <Link
          component={RouterLink}
          to="/signup"
          sx={{
            color: TOKENS.brand,
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { opacity: 0.75 },
          }}
        >
          Sign up again
        </Link>
      </Box>
    </AuthCard>
  );
}
