/**
 * OnboardingWorkspace — /onboarding/workspace
 *
 * Step 2 of the Google sign-up flow. Google has already verified the
 * user's email + given us their name; the only thing left is the
 * workspace name. Single field, single button.
 *
 * Why a separate page (vs inline modal): the user is locked here by
 * PrivateRoute — they can't reach /, /interviews, /profile, etc.
 * until they finish — so a full-page treatment matches the gating
 * model. Mirrors AuthCard layout from Login/CheckInbox so visually
 * the user feels the auth flow hasn't ended yet.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Alert } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { AuthCard } from '../common/AuthCard';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

export default function OnboardingWorkspace() {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a workspace name.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await completeOnboarding(name.trim());
      // PrivateRoute now sees company_id set → releases the gate.
      // Land them on the dashboard root.
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Could not create workspace');
    } finally {
      setSubmitting(false);
    }
  };

  const greeting = user?.email ? user.email.split('@')[0] : 'there';

  return (
    <AuthCard maxWidth={420}>
      <Box sx={{ mb: 2.5 }}>
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
          Welcome, {greeting}.
        </Box>
        <Box
          sx={{
            fontSize: '0.875rem',
            color: TOKENS.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Name your workspace to finish setting up Trueyy. You can rename it later from settings.
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: '10px', py: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      >
        <FormField
          label="Workspace name"
          required
          placeholder="Acme Corp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          autoFocus
        />
        <ActionButton
          type="submit"
          loading={submitting}
          disabled={submitting || !name.trim()}
          fullWidth
          sx={{ mt: 1 }}
        >
          {submitting ? 'Creating workspace…' : 'Continue'}
        </ActionButton>
      </Box>
    </AuthCard>
  );
}
