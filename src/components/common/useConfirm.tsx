import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { ActionButton } from './ActionButton';
import { Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for actions that remove or stop something. */
  danger?: boolean;
}

/**
 * Trueyy-styled replacement for window.confirm, in the same look as the
 * interview page's cancel dialog. Render `dialog` once in the component:
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title: 'Finalize?' })) …
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <Dialog open={!!opts} onClose={() => close(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{opts?.title}</DialogTitle>
      {opts?.body && (
        <DialogContent>
          <Secondary sx={{ color: TOKENS.textSecondary }}>{opts.body}</Secondary>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <ActionButton variant="secondary" onClick={() => close(false)}>{opts?.cancelLabel ?? 'Cancel'}</ActionButton>
        <ActionButton
          autoFocus
          onClick={() => close(true)}
          sx={opts?.danger ? { bgcolor: TOKENS.error, borderColor: TOKENS.error, color: '#fff', '&:hover': { bgcolor: '#DC2626', borderColor: '#DC2626' } } : undefined}
        >
          {opts?.confirmLabel ?? 'Confirm'}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );

  return { confirm, dialog };
}
