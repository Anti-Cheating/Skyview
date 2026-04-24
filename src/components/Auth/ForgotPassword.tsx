/**
 * ForgotPassword — /forgot-password
 *
 * Single email input → POST /auth/forgot-password. Server always
 * returns 200 with a generic "check your inbox if the address is on
 * file" message so we don't leak which emails have accounts. We render
 * the same "check your inbox" confirmation whether the email was
 * recognized or not.
 */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Alert,
  InputAdornment,
  Link,
} from '@mui/material';
import {
  Email as EmailIcon,
  MarkEmailRead as MarkEmailReadIcon,
} from '@mui/icons-material';
import { AuthService } from '../../services/auth.service';
import { isValidEmail, getEmailError } from '../../utils/validation';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(getEmailError(value) || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await AuthService.requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      // Server swallows errors intentionally; this is only for network
      // / 500s. We still show a generic success screen because the
      // attacker-proof response shape is what matters.
      setSent(true);
      if (err?.status >= 500) {
        setError(err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard maxWidth={420}>
        {/* Hero icon — immediately communicates "we sent something,
            now go look at your email". No expiry copy, no spam-folder
            reminder; both live in the email body itself, where the
            user already is once they open it. */}
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
            Check your inbox
          </Box>
          <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary, lineHeight: 1.5 }}>
            We sent a reset link to
          </Box>
          <Box sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary, mt: 0.5 }}>
            {email}
          </Box>
        </Box>

        {/* No retry button on the success card. If the email never
            arrives, the user can just go back and start the flow fresh
            via Sign in → Forgot password — keeps this screen focused
            on "we did the thing, go check your inbox". */}
        <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
          Remembered it?{' '}
          <Link
            component={RouterLink}
            to="/login"
            sx={{
              color: TOKENS.brand,
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': { opacity: 0.75 },
            }}
          >
            Sign in
          </Link>
        </Box>
      </AuthCard>
    );
  }

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 2.5 }}>
        <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.25, mb: 0.5 }}>
          Forgot your password?
        </Box>
        <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary, lineHeight: 1.5 }}>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </Box>
      </Box>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
            {error}
          </Alert>
        )}

        <FormField
          label="Email"
          required
          type="email"
          value={email}
          onChange={handleEmailChange}
          error={!!emailError}
          helperText={emailError}
          disabled={loading}
          autoComplete="email"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon sx={{ fontSize: 18, color: TOKENS.textMuted }} />
              </InputAdornment>
            ),
          }}
        />

        <ActionButton
          type="submit"
          loading={loading}
          disabled={loading || !!emailError || !email.trim()}
          fullWidth
          sx={{ mt: 0.5 }}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </ActionButton>
      </Box>

      <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Remembered it?{' '}
        <Link
          component={RouterLink}
          to="/login"
          sx={{
            color: TOKENS.brand,
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { opacity: 0.75 },
          }}
        >
          Sign in
        </Link>
      </Box>
    </AuthCard>
  );
}
