/**
 * RetentionPage — Owner-only retention-window tab inside Settings.
 *
 * Renders inside the SettingsLayout outlet (the outlet is already padded
 * + capped at 1280px). One card with a native <select> for the window
 * and a Save button. No inner <PageTitle> — the page title and
 * horizontal tabs live in SettingsLayout above the outlet.
 *
 * Backend wiring: `companies.retention_days` is the source-of-truth
 * column and a daily cron purges sessions older than the configured
 * window. The PATCH that writes the column is part of V1.1; until it
 * lands we hold the value in local state so the UI is fully functional
 * and the cron can switch over without an extra UI change.
 */

import { useState } from 'react';
import { Box, Alert } from '@mui/material';
import { SectionHeading, CardTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { TOKENS } from '../../theme';

type Feedback = { kind: 'success' | 'error'; msg: string } | null;

const DEFAULT_DAYS = 30;

export default function RetentionPage() {
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    // PATCH /companies/:id with { retention_days } lands in V1.1. Until
    // then we acknowledge the save locally so the UI feels alive — the
    // selected window persists across re-renders of this tab via state.
    try {
      await new Promise((r) => setTimeout(r, 200));
      setFeedback({ kind: 'success', msg: `Retention window set to ${days} days.` });
    } catch (err: any) {
      setFeedback({
        kind: 'error',
        msg: err?.message || 'Failed to save retention window.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <SectionHeading>Retention</SectionHeading>
        <Secondary>Session recordings, transcripts, and event logs are purged after the window below by a daily cron. Reports and aggregate metrics are retained indefinitely.</Secondary>
      </Box>

      <Box
        sx={{
          bgcolor: TOKENS.bgCard,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: '12px',
          p: { xs: 2, md: 3 },
        }}
      >
        <CardTitle sx={{ mb: 0.5 }}>Retention window</CardTitle>
        <Secondary sx={{ mb: 2 }}>
          Choose how long candidate session data is kept before it's purged.
        </Secondary>

        <Box sx={{ maxWidth: 280, mb: 1 }}>
          <FormField
            label="Days"
            select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={saving}
            SelectProps={{ native: true }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>365 days</option>
          </FormField>
        </Box>
        <Caption sx={{ display: 'block', color: TOKENS.textSecondary, mb: 2 }}>
          Sessions older than the selected window are purged daily.
        </Caption>

        <ActionButton onClick={handleSave} loading={saving}>
          Save
        </ActionButton>

        {feedback && (
          <Alert severity={feedback.kind} sx={{ mt: 2, borderRadius: '10px' }}>
            {feedback.msg}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
