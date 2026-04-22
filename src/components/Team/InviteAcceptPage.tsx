/**
 * InviteAcceptPage — public landing page at /invite/:token.
 *
 * Layout mirrors the sign-in / sign-up entrypoints (same AuthCard + logo
 * lockup). All inputs go through <FormField>, the submit is an
 * <ActionButton>, so styling stays in sync with the rest of the app
 * automatically.
 *
 * Flow:
 *   1. Pull public metadata via InvitesService.getPublic(token). A null
 *      result means the invite is invalid / expired / revoked / already
 *      accepted — show a generic error card; don't leak which.
 *   2. If the invited email is already registered, show a short "click
 *      to accept" button — the backend attaches their existing user to
 *      the new company + role and returns fresh tokens.
 *   3. If the email is new, show a sign-up form (first name, last name,
 *      password) — backend creates the user + attaches them + returns
 *      tokens.
 *   4. On success, stash the tokens in localStorage, refresh auth
 *      context, and land on the dashboard.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { InvitesService, type InvitePublicMeta } from '../../services/invites.service';
import { STORAGE_KEYS } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const [meta, setMeta] = useState<InvitePublicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await InvitesService.getPublic(token);
      if (cancelled) return;
      if (!result) setInvalid(true);
      else setMeta(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (!token || !meta) return;
    setError(null);
    setSubmitting(true);
    try {
      const body = meta.email_already_registered
        ? {}
        : { first_name: firstName.trim(), last_name: lastName.trim(), password };
      const result = await InvitesService.accept(token, body);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, result.data.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));
      await refreshAuth();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invitation');
      setSubmitting(false);
    }
  };

  // ── Loading (pre-metadata fetch) ─────────────────────────────────────

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: TOKENS.bg,
        }}
      >
        <CircularProgress size={28} sx={{ color: TOKENS.brand }} />
      </Box>
    );
  }

  // ── Invalid / expired / revoked invite ───────────────────────────────

  if (invalid || !meta) {
    return (
      <AuthCard maxWidth={420}>
        <Box
          sx={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: TOKENS.textPrimary,
            textAlign: 'center',
            mb: 0.75,
          }}
        >
          Invitation unavailable
        </Box>
        <Box
          sx={{
            fontSize: '0.875rem',
            color: TOKENS.textSecondary,
            textAlign: 'center',
            mb: 2.5,
            lineHeight: 1.5,
          }}
        >
          This invitation link is invalid, has expired, or has already been used. Ask the person
          who invited you to send a new one.
        </Box>
        <ActionButton
          variant="secondary"
          fullWidth
          onClick={() => navigate('/login')}
        >
          Go to sign in
        </ActionButton>
      </AuthCard>
    );
  }

  // ── Main accept flow ─────────────────────────────────────────────────

  const canSubmit = meta.email_already_registered
    ? true
    : firstName.trim().length > 0 && lastName.trim().length > 0 && password.length >= 8;

  return (
    <AuthCard maxWidth={420}>
      {error && (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        autoComplete="off"
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) handleAccept(); }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        <FormField
          label="Company"
          value={meta.company_name ?? '—'}
          locked
        />
        <FormField
          label="Email"
          value={meta.email}
          locked
        />

        {!meta.email_already_registered && (
          <>
            <FormField
              label="First name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={submitting}
              autoComplete="given-name"
              name="firstName"
            />
            <FormField
              label="Last name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={submitting}
              autoComplete="family-name"
              name="lastName"
            />
            <FormField
              label="Password"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
              name="new-password"
              InputProps={{
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
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        )}

        <ActionButton
          type="submit"
          loading={submitting}
          disabled={!canSubmit}
          startIcon={!submitting ? <CheckIcon sx={{ fontSize: 16 }} /> : undefined}
          fullWidth
          sx={{ mt: 0.75 }}
        >
          {submitting ? 'Joining…' : 'Accept invitation'}
        </ActionButton>
      </Box>

      <Box
        sx={{
          textAlign: 'center',
          mt: 2,
          fontSize: '0.75rem',
          color: TOKENS.textMuted,
          lineHeight: 1.5,
        }}
      >
        By accepting, you agree to Trueyy's Terms of Service and Privacy Policy.
      </Box>
    </AuthCard>
  );
}
