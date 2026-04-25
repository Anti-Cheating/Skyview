/**
 * PersonalTab — first/last name edit + read-only email + inline change-
 * password trigger.
 *
 * Change password reuses the existing /auth/forgot-password endpoint
 * (we already know the email — no form needed) and shows a "check your
 * inbox" success block right inside this card. Two reasons over a
 * dedicated change-password endpoint:
 *   1. No new server route or modal to design.
 *   2. Email round-trip is a security upgrade vs. inline old-password
 *      check — stealing a logged-in laptop alone won't let an attacker
 *      rotate the password; they'd need inbox access too.
 */

import { useEffect, useState } from 'react';
import { Box, Alert, Typography } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { LOCKED_INPUT_SX } from '../common/formTokens';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ProfileService } from '../../services/profile.service';
import { AuthService } from '../../services/auth.service';

export default function PersonalTab() {
  const { user, updateUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Three-state machine for the change-password affordance — idle (button
  // visible), sending (disabled + spinner-feel), sent (success block).
  type PwState = 'idle' | 'sending' | 'sent';
  const [pwState, setPwState] = useState<PwState>('idle');

  // Prefill from the cached user on mount and whenever it refreshes.
  useEffect(() => {
    setFirstName(user?.first_name ?? '');
    setLastName(user?.last_name ?? '');
  }, [user?.first_name, user?.last_name]);

  // Disable save when there's nothing to save — both common (no edits
  // yet) and the post-save state (form mirrors the just-persisted user).
  const dirty =
    (firstName.trim() !== (user?.first_name ?? '').trim()) ||
    (lastName.trim() !== (user?.last_name ?? '').trim());

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await ProfileService.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (resp.success && resp.data) {
        showSuccess('Profile updated');
        // Merge the PATCH response into the cached user — sidebar
        // greeting and any other consumers re-render with the new
        // name immediately, no refetch + no isLoading blink.
        updateUser({
          first_name: resp.data.first_name,
          last_name: resp.data.last_name,
        });
      } else {
        const msg = resp.message || 'Failed to update profile';
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Failed to update profile';
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setPwState('sending');
    try {
      await AuthService.requestPasswordReset(user.email);
      setPwState('sent');
    } catch (err: any) {
      // The endpoint is intentionally generic ("If the account exists,
      // we sent a link"), so any thrown error is a real failure (network
      // / server). Surface and let the user retry.
      setPwState('idle');
      const msg = err?.data?.error || err?.message || 'Could not send reset link. Please try again.';
      showError(msg);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: '12px',
        p: { xs: 2, md: 3 },
      }}
    >
      <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 2.5 }}>
        Personal information
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mb: 2.5 }}>
        <FormField
          label="First name"
          required
          placeholder="Jane"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={saving}
        />
        <FormField
          label="Last name"
          required
          placeholder="Doe"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={saving}
        />
      </Box>

      <FormField
        label="Email"
        value={user?.email ?? ''}
        disabled
        sx={LOCKED_INPUT_SX}
      />

      {/* Password section — collapses to a quiet link in the action row
          when idle, expands into a full success block once the reset
          email has been sent. The "Resend" affordance lives only inside
          the success block, so users can't double-fire while sending. */}
      {pwState === 'sent' ? (
        <Box
          sx={{
            mt: 3,
            p: 2,
            border: `1px solid rgba(76, 217, 100, 0.35)`,
            bgcolor: 'rgba(76, 217, 100, 0.06)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 22, color: TOKENS.brand, mt: 0.25 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.25 }}>
              Check your inbox
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: TOKENS.textSecondary }}>
              We sent a reset link to <strong style={{ color: TOKENS.textPrimary }}>{user?.email}</strong>.
              The link is single-use and will sign you out of all sessions when you set the new password.
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
        {/* Change-password trigger — hidden once the email has been sent.
            No resend affordance: the success block above already explains
            what's happening, and a refresh is the cleanest way to retry. */}
        {pwState !== 'sent' ? (
          <Box
            component="button"
            type="button"
            onClick={handleChangePassword}
            disabled={pwState === 'sending'}
            sx={{
              background: 'none',
              border: 0,
              p: 0,
              cursor: pwState === 'sending' ? 'default' : 'pointer',
              color: pwState === 'sending' ? TOKENS.textSecondary : TOKENS.brand,
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 600,
              '&:hover': pwState === 'sending' ? {} : { opacity: 0.75 },
            }}
          >
            {pwState === 'sending' ? 'Sending…' : 'Change password'}
          </Box>
        ) : (
          // Empty spacer keeps the Save button right-aligned via
          // justifyContent: space-between when the change-password
          // trigger is hidden.
          <Box />
        )}
        <ActionButton onClick={handleSave} loading={saving} disabled={!dirty || saving}>
          Save changes
        </ActionButton>
      </Box>
    </Box>
  );
}
