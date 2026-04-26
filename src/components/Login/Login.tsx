/**
 * Login — white-card auth flow matching InviteAcceptPage / Signup.
 *
 * Every input uses the shared <FormField>, the submit uses <ActionButton>,
 * and the card + logo come from <AuthCard>. All the auth logic
 * (isValidEmail, post-login redirect handled by AuthRoute) is unchanged.
 */

import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../types/api.types';
import { isValidEmail, getEmailError } from '../../utils/validation';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  // Note: post-login redirect (including ?returnTo=) is handled by AuthRoute
  // in App.tsx — once `login()` flips isAuthenticated to true, AuthRoute
  // re-renders and Navigates to the right place. We don't navigate here.

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(getEmailError(value) || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setEmailError('Please enter a valid email address');
      setLoading(false);
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      await login({ email, password });
      // AuthRoute (App.tsx) handles the post-login redirect, including
      // ?returnTo= (which is how the /authorize-extension flow comes back
      // here after login).
    } catch (err: any) {
      const apiError = err as ApiError;
      // Email-not-verified: server returns 403 with code === 'EMAIL_NOT_VERIFIED'.
      // Send the user to /check-inbox with the email pre-filled so they
      // can resend the link from the same component the signup flow uses.
      const code = (apiError as { data?: { code?: string } })?.data?.code;
      if (apiError.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/check-inbox?email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
      if (apiError.status === 401) setError('Invalid email or password');
      else if (apiError.status === 0)
        setError('Unable to connect to server. Please check if the server is running.');
      else setError(apiError.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const disableSubmit = loading || !email.trim() || !password.trim() || !!emailError;

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 2.5 }}>
        <Box
          sx={{
            fontSize: '1.375rem',
            fontWeight: 700,
            color: TOKENS.textPrimary,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            mb: 0.5,
          }}
        >
          Welcome back.
        </Box>
        <Box
          sx={{
            fontSize: '0.875rem',
            color: TOKENS.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Sign in and get back to your interviews.
        </Box>
      </Box>

      {(error || emailError) && (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {error || emailError}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        autoComplete="on"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        <FormField
          label="Email"
          required
          type="email"
          value={email}
          onChange={handleEmailChange}
          disabled={loading}
          error={!!emailError}
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

        <FormField
          label="Password"
          required
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon sx={{ fontSize: 18, color: TOKENS.textMuted }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                  tabIndex={-1}
                  sx={{ color: TOKENS.textSecondary }}
                >
                  {showPassword ? (
                    <VisibilityOff fontSize="small" />
                  ) : (
                    <Visibility fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Right-aligned "Forgot password?" tucked directly under the
            password field. Styled identically to the "Sign up" link in
            the footer — brand green, fontWeight 600, underline on
            hover — so all inline auth links on this page read the same. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
          <Link
            component={RouterLink}
            to="/forgot-password"
            sx={{
              fontSize: '0.813rem',
              color: TOKENS.brand,
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': { opacity: 0.75 },
            }}
          >
            Forgot password?
          </Link>
        </Box>

        <ActionButton
          type="submit"
          loading={loading}
          disabled={disableSubmit}
          fullWidth
          sx={{ mt: 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </ActionButton>
      </Box>

      <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Don&apos;t have an account?{' '}
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
          Sign up
        </Link>
      </Box>
    </AuthCard>
  );
}
