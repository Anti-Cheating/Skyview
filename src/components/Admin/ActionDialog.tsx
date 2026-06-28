import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography } from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';

export interface ActionDialogProps {
  open: boolean;
  title: string;
  /** Optional body copy (e.g. a confirmation question). */
  message?: string;
  /** Provide to show an input field; omit for a plain confirm dialog. */
  input?: { label: string; type?: 'text' | 'number'; placeholder?: string };
  confirmLabel?: string;
  /** Red confirm button for destructive actions (suspend, delete). */
  destructive?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

/**
 * Reusable MUI modal that replaces native window.prompt/confirm in the admin
 * console — matches the design system (TOKENS + ActionButton). Pass `input`
 * for a prompt, omit it for a confirm.
 */
export default function ActionDialog({
  open, title, message, input, confirmLabel = 'Confirm', destructive, busy, onClose, onConfirm,
}: ActionDialogProps) {
  const [value, setValue] = useState('');
  useEffect(() => { if (open) setValue(''); }, [open]);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ color: TOKENS.textPrimary, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {message && (
          <Typography sx={{ color: TOKENS.textSecondary, mb: input ? 2 : 0 }}>{message}</Typography>
        )}
        {input && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            type={input.type ?? 'text'}
            label={input.label}
            placeholder={input.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) onConfirm(value); }}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
        <ActionButton
          onClick={() => onConfirm(value)}
          loading={busy}
          sx={destructive ? { bgcolor: TOKENS.error, '&:hover': { bgcolor: '#DC2626' } } : undefined}
        >
          {confirmLabel}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
