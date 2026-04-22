/**
 * Signup — white-card auth flow matching Login / InviteAcceptPage.
 *
 * All inputs go through <FormField>, the submit is an <ActionButton>,
 * the card + logo come from <AuthCard>. The validation rules and
 * signup() call are unchanged from the previous dark-card version.
 */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import { TOKENS } from '../../theme';

export default function Signup() {
  const { signup } = useAuth();
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
      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        email: formData.email,
        password: formData.password,
      });
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
      <Box
        sx={{
          textAlign: 'center',
          mb: 2.5,
          fontSize: '1.125rem',
          fontWeight: 700,
          color: TOKENS.textPrimary,
          letterSpacing: '-0.01em',
        }}
      >
        Create your account
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

      <Box sx={{ textAlign: 'center', mt: 2, fontSize: '0.813rem', color: TOKENS.textSecondary }}>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to="/login"
          sx={{
            color: TOKENS.brand,
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
