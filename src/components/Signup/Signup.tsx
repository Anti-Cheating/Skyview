/**
 * Signup — white-card auth flow matching Login / InviteAcceptPage.
 *
 * All inputs go through <FormField>, the submit is an <ActionButton>,
 * the card + logo come from <AuthCard>. The validation rules and
 * signup() call are unchanged from the previous dark-card version.
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
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../types/api.types';
import { isValidEmail, isStrongPassword } from '../../utils/validation';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { GoogleAuthButton } from '../Auth/GoogleAuthButton';
import { TOKENS } from '../../theme';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password =
        'Password must be at least 8 characters with uppercase, lowercase, and number';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form-validity check used to gate the submit button. Mirrors the
  // submit-time validateForm() rules but doesn't write to error state —
  // we don't want to show red borders before the user has touched a
  // field. Returns true when the form is structurally OK to submit.
  const isFormValid = (() => {
    if (!formData.firstName.trim()) return false;
    if (!formData.lastName.trim()) return false;
    if (!formData.companyName.trim()) return false;
    if (!formData.email.trim() || !isValidEmail(formData.email)) return false;
    if (!formData.password || !isStrongPassword(formData.password)) return false;
    if (!formData.confirmPassword || formData.password !== formData.confirmPassword) return false;
    return true;
  })();

  // Live "passwords match" hint shown under the confirm field. Empty
  // string while the field is empty (no point shouting before they've
  // typed). Different from the submit-time error so we don't double-up.
  const matchHint =
    formData.confirmPassword && formData.password !== formData.confirmPassword
      ? "Passwords don't match"
      : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const { email } = await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        email: formData.email,
        password: formData.password,
      });
      // Email-verification flow: signup didn't log the user in. Send
      // them to /check-inbox with the email pre-filled so they know
      // where to look and can resend if needed.
      navigate(`/check-inbox?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.status === 0) {
        setApiError('Unable to connect to server. Please check if the server is running.');
      } else if (apiError.status === 400 || apiError.status === 409) {
        setApiError(apiError.message || 'Email already exists or invalid input');
      } else {
        setApiError(apiError.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const iconAdornment = (Icon: typeof PersonIcon) => ({
    startAdornment: (
      <InputAdornment position="start">
        <Icon sx={{ fontSize: 18, color: TOKENS.textMuted }} />
      </InputAdornment>
    ),
  });

  const passwordAdornment = (shown: boolean, toggle: () => void) => ({
    startAdornment: (
      <InputAdornment position="start">
        <LockIcon sx={{ fontSize: 18, color: TOKENS.textMuted }} />
      </InputAdornment>
    ),
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          size="small"
          onClick={toggle}
          edge="end"
          // Was tabIndex={-1} → keyboard users couldn't toggle visibility.
          // aria-label is what screen readers announce; aria-pressed
          // exposes the toggled state.
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          sx={{ color: TOKENS.textSecondary }}
        >
          {shown ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </InputAdornment>
    ),
  });

  // ── Live password strength meter ───────────────────────────────────
  // Maps the password against the same rules as `isStrongPassword`
  // (≥ 8 chars, lower, upper, digit) plus a bonus for symbols. Score is
  // 0..4 → mapped to a label + bar fill width + colour. The exact rule
  // wording lives in `validation.ts` so users see the same language at
  // submit-time as while typing.
  const passwordScore = (pw: string): number => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    return score;
  };
  const score = passwordScore(formData.password);
  const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const STRENGTH_COLORS = ['transparent', '#EF4444', '#F59E0B', '#10B981', TOKENS.brand];

  // Consolidate form errors into a single banner message. We deliberately
  // DON'T render per-field helper text for validation errors — the red
  // border + this summary is enough, and it keeps the card from scrolling
  // when 6 fields fail at once (Clerk / Vercel / Stripe pattern).
  const firstError = Object.values(errors).find(Boolean);
  const bannerMessage = apiError || firstError || '';

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: 2.5 }}>
        <Box
          component="h1"
          sx={{
            m: 0,
            fontSize: '1.375rem',
            fontWeight: 700,
            color: TOKENS.textPrimary,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            mb: 0.5,
          }}
        >
          Welcome to Trueyy.
        </Box>
        <Box
          sx={{
            fontSize: '0.875rem',
            color: TOKENS.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Create your account to start hiring with integrity.
        </Box>
      </Box>

      {bannerMessage && (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {bannerMessage}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        autoComplete="on"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        <FormField
          label="First name"
          required
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.firstName}
          autoComplete="given-name"
          autoFocus
          InputProps={iconAdornment(PersonIcon)}
        />

        <FormField
          label="Last name"
          required
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.lastName}
          autoComplete="family-name"
          InputProps={iconAdornment(PersonIcon)}
        />

        <FormField
          label="Company name"
          required
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.companyName}
          autoComplete="organization"
          InputProps={iconAdornment(BusinessIcon)}
        />

        <FormField
          label="Email"
          required
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.email}
          autoComplete="email"
          InputProps={iconAdornment(EmailIcon)}
        />

        <FormField
          label="Password"
          required
          type={showPassword ? 'text' : 'password'}
          name="password"
          value={formData.password}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.password}
          autoComplete="new-password"
          InputProps={passwordAdornment(showPassword, () => setShowPassword((v) => !v))}
        />

        {/* Live password strength meter — only renders once the user has
            typed something so we don't pre-shame an empty field. The bar
            steps from 1/4 to 4/4 width as the rules are met (length,
            mixed case, digit, symbol). Label is announced via aria-live
            so screen readers hear "Strong" without the user re-focusing
            the field. */}
        {formData.password && (
          <Box sx={{ mt: -0.5 }}>
            <Box
              sx={{
                height: 4,
                borderRadius: 999,
                bgcolor: TOKENS.borderLight,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${(score / 4) * 100}%`,
                  bgcolor: STRENGTH_COLORS[score],
                  transition: 'width 180ms ease, background-color 180ms ease',
                }}
              />
            </Box>
            <Box
              aria-live="polite"
              sx={{
                mt: 0.5,
                fontSize: '0.688rem',
                color: TOKENS.textSecondary,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box component="span">
                Strength:{' '}
                <Box
                  component="span"
                  sx={{ color: STRENGTH_COLORS[score], fontWeight: 600 }}
                >
                  {STRENGTH_LABELS[score] || '—'}
                </Box>
              </Box>
              <Box component="span" sx={{ color: TOKENS.textMuted }}>
                8+ chars · upper · lower · number
              </Box>
            </Box>
          </Box>
        )}

        <FormField
          label="Confirm password"
          required
          type={showConfirmPassword ? 'text' : 'password'}
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={loading}
          // Live mismatch feedback uses the same red border as the
          // submit-time error state so the user gets one consistent
          // signal: red = fix me. We only flag mismatch when the field
          // has content (avoids flashing red as the user types).
          error={!!errors.confirmPassword || !!matchHint}
          helperText={matchHint || undefined}
          autoComplete="new-password"
          InputProps={passwordAdornment(showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
        />

        <ActionButton
          type="submit"
          loading={loading}
          // Disable until every field is valid — matches the Sign-in
          // button behaviour. Previously this was always enabled, so
          // users could click Sign up with an empty form and only then
          // see the validation banner.
          disabled={loading || !isFormValid}
          fullWidth
          sx={{ mt: 0.75 }}
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </ActionButton>
      </Box>

      {/* Google sign-up — auto-routes to /onboarding/workspace for new
          users so they can name their workspace before landing in the
          app. Auto-hides if VITE_GOOGLE_CLIENT_ID isn't set. */}
      <GoogleAuthButton mode="signup" onError={(msg) => setApiError(msg)} />

      <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to="/login"
          sx={{
            color: TOKENS.brandText,
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Sign in
        </Link>
      </Box>
    </AuthCard>
  );
}
