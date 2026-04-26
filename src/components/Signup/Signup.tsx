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
          tabIndex={-1}
          sx={{ color: TOKENS.textSecondary }}
        >
          {shown ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </InputAdornment>
    ),
  });

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
          sx={{
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

        <FormField
          label="Confirm password"
          required
          type={showConfirmPassword ? 'text' : 'password'}
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={loading}
          error={!!errors.confirmPassword}
          autoComplete="new-password"
          InputProps={passwordAdornment(showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
        />

        <ActionButton
          type="submit"
          loading={loading}
          disabled={loading}
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
