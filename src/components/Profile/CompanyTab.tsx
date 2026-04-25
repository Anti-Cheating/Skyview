/**
 * CompanyTab — Owner-only. Loads the current company on mount, lets
 * the Owner rename it, and shows a soft success on save. The new name
 * flows into invite emails, candidate join page, and dashboard counts
 * because all of those read company-by-id at render time — no cache
 * to bust.
 */

import { useEffect, useState } from 'react';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { CompaniesService } from '../../services/companies.service';

interface CompanyTabProps {
  companyId: string;
}

export default function CompanyTab({ companyId }: CompanyTabProps) {
  const { showSuccess, showError } = useSnackbar();
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await CompaniesService.getById(companyId);
        if (cancelled) return;
        if (resp.success && resp.data) {
          setName(resp.data.name);
          setOriginalName(resp.data.name);
        } else {
          setError(resp.message || 'Failed to load company');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.data?.error || err?.message || 'Failed to load company');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const dirty = name.trim() !== originalName.trim();

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const resp = await CompaniesService.update(companyId, { name: name.trim() });
      if (resp.success && resp.data) {
        showSuccess('Company name updated');
        setOriginalName(resp.data.name);
        setName(resp.data.name);
      } else {
        const msg = resp.message || 'Failed to update company';
        setError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Failed to update company';
      setError(msg);
      showError(msg);
    } finally {
      setSaving(false);
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
        Company details
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={20} thickness={5} sx={{ color: TOKENS.brand }} />
        </Box>
      ) : (
        <>
          <FormField
            label="Company name"
            required
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <ActionButton onClick={handleSave} loading={saving} disabled={!dirty || saving}>
              Save changes
            </ActionButton>
          </Box>
        </>
      )}
    </Box>
  );
}
