/**
 * FormField — the one input primitive used across every form in Skyview.
 *
 *   <FormField label="Email" value={email} onChange={...} />
 *   <FormField label="Role" select>{...menu items...}</FormField>
 *   <FormField label="Email" value={meta.email} locked />
 *
 * Renders an external label above a MUI <TextField> styled with the
 * shared INPUT_SX tokens. All TextFieldProps forward transparently so
 * selects, multiline, adornments, etc. just work.
 *
 * Choices deliberately baked in:
 *   - `size="small"` by default (matches CreateInterview density)
 *   - `fullWidth` defaults true because 99% of callers want it
 *   - MUI's floating label is hidden — we use the external <Label>
 *   - `locked` = non-editable but still renders value at full contrast,
 *     for "this was set by the invite, you can't change it" fields.
 */

import { forwardRef } from 'react';
import { Box, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { INPUT_SX, LABEL_SX, LOCKED_INPUT_SX } from './formTokens';
import { TOKENS } from '../../theme';

export interface FormFieldProps extends Omit<TextFieldProps, 'variant' | 'label'> {
  /** Text label rendered above the input. */
  label?: string;
  /** Appends a muted "(optional)" marker after the label. */
  optional?: boolean;
  /** Appends a small red asterisk after the label. */
  required?: boolean;
  /** Read-only + disabled styling kept legible (Company/Email on invite). */
  locked?: boolean;
  /** Help text shown under the input (maps to MUI helperText). */
  hint?: React.ReactNode;
  /** Extra sx applied to the OUTER wrapper, not the input. */
  wrapperSx?: SxProps<Theme>;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  {
    label,
    optional,
    required,
    locked,
    hint,
    helperText,
    wrapperSx,
    size = 'small',
    fullWidth = true,
    InputProps,
    disabled,
    sx,
    ...rest
  },
  ref,
) {
  const inputSx = locked ? LOCKED_INPUT_SX : INPUT_SX;

  return (
    <Box ref={ref} sx={wrapperSx}>
      {label && (
        <Box sx={LABEL_SX}>
          <span>{label}</span>
          {required && (
            <Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>
              *
            </Box>
          )}
          {optional && (
            <Box
              component="span"
              sx={{
                fontSize: '0.75rem',
                color: TOKENS.textMuted,
                fontWeight: 400,
              }}
            >
              (optional)
            </Box>
          )}
        </Box>
      )}
      <TextField
        variant="outlined"
        size={size}
        fullWidth={fullWidth}
        disabled={locked || disabled}
        InputProps={{
          ...(locked ? { readOnly: true } : null),
          ...InputProps,
        }}
        helperText={hint ?? helperText}
        sx={[inputSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>}
        {...rest}
      />
    </Box>
  );
});
