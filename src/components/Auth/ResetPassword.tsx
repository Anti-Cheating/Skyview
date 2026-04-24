/**
 * ResetPassword — /reset-password?token=...
 *
 * Consumes the single-use token from the email link, accepts a new
 * password + confirmation, POSTs to /auth/reset-password. Server
 * rejects expired / missing / reused tokens with a generic error.
 *
 * Every refresh token for the user is invalidated on success, so any
 * existing sessions on other devices will be forced back through
 * login.
 */

import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { AuthService } from '../../services/auth.service';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { TOKENS } from '../../theme';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 128) return 'Password is too long';
  if (!/[a-z]/.test(pw)) return 'Add at least one lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'Add at least one uppercase letter';
  if (!/\d/.test(pw)) return 'Add at least one number';
  return null;
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { showSuccess } = useSnackbar();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tokenMissing = !token;

  const passwordError = useMemo(
    () => (password ? validatePassword(password) : null),
    [password],
  );
  const confirmError = useMemo(() => {
    if (!confirm) return null;
    if (password !== confirm) return 'Passwords do not match';
    return null;
  }, [password, confirm]);

  const canSubmit =
    !loading &&
    !tokenMissing &&
    !!password &&
    !!confirm &&
    !passwordError &&
    !confirmError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      await AuthService.resetPassword(token, password);
      showSuccess('Your password has been updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(
        err?.data?.error ||
          err?.message ||
          'Unable to reset password. The link may have expired — please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (tokenMissing) {
    return (
      <AuthCard maxWidth={420}>
        <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 2.5 }}>
          <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.25, mb: 0.5 }}>
            Reset link invalid
          </Box>
          <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary, lineHeight: 1.5 }}>
            This page needs a valid reset link from your email.
          </Box>
        </Box>
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
          We couldn&apos;t find a reset token in this URL. Please request a new
          link from the forgot-password page.
        </Alert>
        <ActionButton
          fullWidth
          onClick={() => navigate('/forgot-password', { replace: true })}
        >
          Request new link
        </ActionButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 2.5 }}>
        <Box sx={{ fontSize: '1.375rem', fontWeight: 700, color: TOKENS.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.25, mb: 0.5 }}>
          Set a new password
        </Box>
        <Box sx={{ fontSize: '0.875rem', color: TOKENS.textSecondary, lineHeight: 1.5 }}>
          Enter a new password below to change your password.
        </Box>
      </Box>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1, borderRadius: '10px', py: 0.5 }}>
            {error}
          </Alert>
        )}

        <FormField
          label="New password"
          required
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={!!passwordError}
          helperText={passwordError ?? 'At least 8 chars with upper, lower and a number.'}
          disabled={loading}
          autoComplete="new-password"
          autoFocus
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

        <FormField
          label="Confirm new password"
          required
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={!!confirmError}
          helperText={confirmError ?? ''}
          disabled={loading}
          autoComplete="new-password"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon sx={{ fontSize: 18, color: TOKENS.textMuted }} />
              </InputAdornment>
            ),
          }}
        />

        <ActionButton
          type="submit"
          loading={loading}
          disabled={!canSubmit}
          fullWidth
          sx={{ mt: 0.5 }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </ActionButton>
      </Box>

      <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Back to{' '}
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
          sign in
        </Link>
      </Box>
    </AuthCard>
  );
}
