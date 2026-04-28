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

import { useEffect, useRef, useState } from 'react';
import { Box, Alert, Typography, IconButton, CircularProgress } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { LOCKED_INPUT_SX } from '../common/formTokens';
import { TOKENS } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ProfileService } from '../../services/profile.service';
import { AuthService } from '../../services/auth.service';

function getInitials(first?: string, last?: string, email?: string): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f && l) return (f[0]! + l[0]!).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}


export default function PersonalTab() {
  const { user, updateUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
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

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showError('Avatar must be an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('Avatar must be 2MB or smaller');
      return;
    }
    setAvatarBusy(true);
    try {
      const updated = await AuthService.uploadAvatar(file);
      // Push the new avatar URL into AuthContext so the sidebar
      // re-renders without a refetch. We only need the avatar_url
      // delta since updateUser merges by key.
      updateUser({ avatar_url: updated.avatar_url ?? null });
      showSuccess('Profile picture updated');
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Avatar upload failed');
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarBusy(true);
    try {
      await AuthService.deleteAvatar();
      updateUser({ avatar_url: null });
      showSuccess('Profile picture removed');
    } catch (err: any) {
      showError(err?.data?.error || err?.message || 'Failed to remove picture');
    } finally {
      setAvatarBusy(false);
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
      <Typography
        component="h2"
        sx={{ m: 0, fontSize: '1rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 2.5 }}
      >
        Personal information
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

      {/* Avatar block — circular dropzone with a full dimming overlay
          on hover. Empty state shows the user's initials + a click-to-
          upload hint; filled state surfaces Replace + Delete in the
          centre of the dimmed overlay. The Company tab uses the same
          interaction pattern (dimmed overlay, centred buttons) on a
          square tile so both editors feel coherent. */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.25 }}>
          Profile picture
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary, mb: 1.25 }}>
          PNG, JPG, WebP, or SVG. Up to 2MB.
        </Typography>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAvatarFile(f);
          }}
        />

        <Box
          role={user?.avatar_url ? undefined : 'button'}
          tabIndex={user?.avatar_url ? -1 : 0}
          onClick={() => {
            if (avatarBusy) return;
            if (!user?.avatar_url) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (avatarBusy || user?.avatar_url) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          sx={{
            position: 'relative',
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `1px ${user?.avatar_url ? 'solid' : 'dashed'} ${TOKENS.border}`,
            bgcolor: '#FAFAFA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: user?.avatar_url || avatarBusy ? 'default' : 'pointer',
            transition: 'border-color 120ms ease, background-color 120ms ease',
            '&:hover': user?.avatar_url
              ? { '& .avatar-actions': { opacity: 1 } }
              : {
                  borderColor: TOKENS.brand,
                  bgcolor: `${TOKENS.brand}08`,
                },
          }}
        >
          {user?.avatar_url ? (
            <>
              <img
                key={user.avatar_url}
                src={user.avatar_url}
                alt="Profile picture"
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <Box
                className="avatar-actions"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  opacity: 0,
                  transition: 'opacity 120ms ease',
                }}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!avatarBusy) fileInputRef.current?.click();
                  }}
                  disabled={avatarBusy}
                  aria-label="Replace picture"
                  sx={{
                    bgcolor: '#FFFFFF',
                    color: TOKENS.textPrimary,
                    '&:hover': { bgcolor: '#F3F4F6' },
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!avatarBusy) handleAvatarRemove();
                  }}
                  disabled={avatarBusy}
                  aria-label="Remove picture"
                  sx={{
                    bgcolor: '#FFFFFF',
                    color: TOKENS.textSecondary,
                    '&:hover': { bgcolor: '#FEE2E2', color: '#B91C1C' },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              {avatarBusy && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(255,255,255,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', px: 2 }}>
              {avatarBusy ? (
                <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
              ) : (
                <>
                  <Typography
                    sx={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: TOKENS.textMuted,
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {getInitials(user?.first_name, user?.last_name, user?.email)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: TOKENS.textSecondary, mt: 0.5 }}>
                    Click to upload
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>

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
