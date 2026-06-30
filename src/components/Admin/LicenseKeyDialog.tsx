import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { CardTitle, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { TOKENS } from '../../theme';

export interface LicenseKeyDialogProps {
  open: boolean;
  companyName: string;
  token: string;
  expiresAt?: string | null;
  /** Cloud authority the customer's Cortex calls back to. */
  apiUrl?: string;
  onClose: () => void;
}

/**
 * Shows an enterprise license key + the .env setup pack the customer drops into
 * their self-hosted Cortex. The token is re-signable server-side, so this can be
 * reopened anytime to re-share the key.
 */
export default function LicenseKeyDialog({
  open, companyName, token, expiresAt, apiUrl = 'https://api.trueyy.com', onClose,
}: LicenseKeyDialogProps) {
  const { showSuccess } = useSnackbar();

  const envBlock = [
    `TRUEYY_LICENSE=${token}`,
    `TRUEYY_LICENSE_API_URL=${apiUrl}`,
    'DATABASE_URL=postgresql://<your own database>',
  ].join('\n');

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => showSuccess(`${label} copied`)).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: TOKENS.textPrimary, fontWeight: 700 }}>
        License key — {companyName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <CardTitle>License token</CardTitle>
            <Tooltip title="Copy token">
              <IconButton size="small" onClick={() => copy(token, 'Token')}><CopyIcon sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
          </Box>
          <TextField value={token} fullWidth multiline minRows={3} size="small" InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
          {expiresAt && (
            <Caption sx={{ color: TOKENS.textSecondary, mt: 0.5, display: 'block' }}>
              Expires {new Date(expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Caption>
          )}
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <CardTitle>Customer setup (.env)</CardTitle>
            <Tooltip title="Copy .env block">
              <IconButton size="small" onClick={() => copy(envBlock, 'Setup')}><CopyIcon sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
          </Box>
          <TextField value={envBlock} fullWidth multiline minRows={3} size="small" InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
          <Caption sx={{ color: TOKENS.textSecondary, mt: 1, display: 'block' }}>
            The customer sets these in their self-hosted Cortex. The token carries identity + expiry only —
            the interview cap and billing are enforced from our side, so they can't exceed or forge it.
          </Caption>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <ActionButton variant="secondary" onClick={onClose}>Close</ActionButton>
        <ActionButton onClick={() => copy(envBlock, 'Setup')}>Copy setup</ActionButton>
      </DialogActions>
    </Dialog>
  );
}
