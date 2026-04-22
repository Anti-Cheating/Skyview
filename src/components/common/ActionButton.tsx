/**
 * ActionButton — one button primitive that renders either the primary
 * brand-green CTA or the neutral outlined secondary, with a baked-in
 * loading spinner.
 *
 *   <ActionButton onClick={save}>Save</ActionButton>
 *   <ActionButton variant="secondary" onClick={cancel}>Cancel</ActionButton>
 *   <ActionButton loading>Saving…</ActionButton>
 *
 * Forwards all MUI ButtonProps transparently. Sizing + colours come from
 * PRIMARY_BUTTON_SX / SECONDARY_BUTTON_SX in formTokens, so a single
 * edit there updates every button everywhere.
 */

import { forwardRef } from 'react';
import { Button, CircularProgress } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { PRIMARY_BUTTON_SX, SECONDARY_BUTTON_SX } from './formTokens';

export type ActionButtonVariant = 'primary' | 'secondary';

export interface ActionButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: ActionButtonVariant;
  /** Shows a spinner in the leading position and forces disabled. */
  loading?: boolean;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      variant = 'primary',
      loading = false,
      disabled,
      startIcon,
      sx,
      children,
      ...rest
    },
    ref,
  ) {
    const baseSx = variant === 'primary' ? PRIMARY_BUTTON_SX : SECONDARY_BUTTON_SX;

    return (
      <Button
        ref={ref}
        size="small"
        // MUI variant is controlled purely by our sx; we pass `text` to
        // avoid MUI layering its own outlined/contained borders on top.
        variant="text"
        disabled={loading || disabled}
        startIcon={
          loading ? (
            <CircularProgress
              size={14}
              thickness={5}
              sx={{ color: variant === 'primary' ? '#FFFFFF' : 'inherit' }}
            />
          ) : (
            startIcon
          )
        }
        sx={[baseSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);
