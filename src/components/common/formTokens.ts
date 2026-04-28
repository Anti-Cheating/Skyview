/**
 * formTokens.ts — single source of truth for form-control styling across
 * Skyview. Every form primitive (FormField, ActionButton, AuthCard)
 * references these. When a page needs a form, it should reach for the
 * shared primitives rather than inlining its own sx.
 *
 * The values codify what CreateInterviewPage was already using — the
 * baseline the team picked as "this looks right". Three improvements were
 * rolled in during the extraction:
 *
 *   1. Focus state uses a box-shadow ring instead of bumping border-width
 *      from 1px → 1.5px. Same brand feel, no sub-pixel layout shift.
 *   2. Disabled border is pinned to TOKENS.border explicitly instead of
 *      falling back to MUI's default disabled shade.
 *   3. Error border is explicitly the brand error red instead of the MUI
 *      default, so invalid fields look intentional.
 */

import type { SxProps, Theme } from '@mui/material/styles';
import { TOKENS } from '../../theme';

// Input — applies to <TextField sx={INPUT_SX} />. Covers outlined inputs,
// selects, and any slot-based wrapper (DateTimePicker, TimePicker, etc).
//
// Targeting notes:
//   - Two class families are styled because MUI X v8+ ships its own
//     `PickersTextField` that renders `MuiPickersOutlinedInput-*` classes
//     instead of the regular `MuiOutlinedInput-*`. Both are targeted so
//     every input in the app — plain TextField, Select, DateTimePicker —
//     lands on the same exact styling.
//   - `!important` on border-width + border-color because MUI X's own
//     theme-level styleOverrides sit at matching specificity, so without
//     `!important` the picker's 2px bright-green focus border sometimes
//     wins over our 1px + soft ring.
//   - 3px brand-tinted box-shadow provides the focus emphasis so the
//     border stays at 1px on every state — no layout jump on focus.
const borderColorRule = (color: string) => ({
  borderColor: `${color} !important`,
  borderWidth: '1px !important',
});

const inputRootSx = {
  borderRadius: '10px',
  fontSize: '0.875rem',
  transition: 'box-shadow 120ms ease, border-color 120ms ease',
  // Default
  '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline':
    borderColorRule(TOKENS.border),
  // Hover (on the wrapper)
  '&:hover .MuiOutlinedInput-notchedOutline, &:hover .MuiPickersOutlinedInput-notchedOutline':
    borderColorRule('#D1D5DB'),
  // Focus ring via box-shadow
  '&.Mui-focused': {
    boxShadow: '0 0 0 3px rgba(76, 217, 100, 0.14)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiPickersOutlinedInput-notchedOutline':
    borderColorRule(TOKENS.brand),
  // Disabled
  '&.Mui-disabled .MuiOutlinedInput-notchedOutline, &.Mui-disabled .MuiPickersOutlinedInput-notchedOutline':
    borderColorRule(TOKENS.border),
  // Error
  '&.Mui-error .MuiOutlinedInput-notchedOutline, &.Mui-error .MuiPickersOutlinedInput-notchedOutline':
    borderColorRule(TOKENS.error),
  '&.Mui-error.Mui-focused': {
    boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.14)',
  },
};

export const INPUT_SX: SxProps<Theme> = {
  // Apply the same rules whether the root is MUI's OutlinedInput or MUI X's
  // PickersOutlinedInput — a single selector list keeps them in sync.
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': inputRootSx,
  // MUI's floating label gets in the way of our external <Label>; hide it.
  '& .MuiInputLabel-root': {
    display: 'none',
  },
  // Chrome/Safari paint autofilled inputs with a hard-coded lavender
  // (rgb(232,240,254)). That ignores our card styling and looks like an
  // unstyled state. The 5000s `transition-delay` trick keeps the swatch
  // overridden indefinitely. `-webkit-text-fill-color` is required because
  // autofill ignores `color`. We also clamp the caret colour back to
  // textPrimary so the cursor stays visible.
  '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active':
    {
      WebkitBoxShadow: '0 0 0 1000px #FFFFFF inset !important',
      WebkitTextFillColor: `${TOKENS.textPrimary} !important`,
      caretColor: `${TOKENS.textPrimary} !important`,
      transition: 'background-color 5000s ease-in-out 0s',
      borderRadius: '10px',
    },
  // Helper text — tighten to 11px and kill the big default margin/reserved
  // space so it doesn't pad the form vertically when present.
  '& .MuiFormHelperText-root': {
    fontSize: '0.688rem',
    lineHeight: 1.3,
    marginTop: '3px',
    marginLeft: 0,
  },
};

// Read-only "locked" variant for Company/Email on invite, or any field the
// user must see but can't edit. Keeps the value at full text colour so
// it's readable, unlike MUI's washed-out default.
export const LOCKED_INPUT_SX: SxProps<Theme> = {
  ...INPUT_SX,
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: TOKENS.textPrimary,
    color: TOKENS.textPrimary,
    fontWeight: 500,
  },
  '& .MuiOutlinedInput-root.Mui-disabled': {
    bgcolor: TOKENS.bg,
  },
};

// External label above the input — intentionally not a floating MUI
// label because CreateInterview (and every other page we're aligning to)
// uses an above-field label.
export const LABEL_SX: SxProps<Theme> = {
  fontSize: '0.813rem',
  fontWeight: 600,
  color: '#374151',
  mb: 0.75,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  lineHeight: 1.4,
};

// Shared height + focus ring so primary and secondary CTAs line up exactly
// on auth screens (Sign in vs Sign in with Google). Pinning minHeight beats
// matching px/py because `:has(svg)` from the Google icon wrapper otherwise
// nudges the secondary button taller by ~2px.
const BUTTON_BASE = {
  textTransform: 'none' as const,
  fontWeight: 600,
  borderRadius: '8px',
  px: 2.5,
  py: 0.75,
  minHeight: 40,
  fontSize: '0.8rem',
  whiteSpace: 'nowrap' as const,
  // Default-removes the dotted outline, then re-adds a clear keyboard ring
  // via :focus-visible only (mouse clicks stay clean). 3px ring matches
  // the input focus ring above so the visual language is consistent.
  outline: 'none',
  '&:focus-visible': {
    boxShadow: '0 0 0 3px rgba(76, 217, 100, 0.35)',
  },
};

// Primary CTA (green fill). Baked-in sizing from CreateInterview footer.
export const PRIMARY_BUTTON_SX: SxProps<Theme> = {
  ...BUTTON_BASE,
  bgcolor: TOKENS.brand,
  color: '#FFFFFF',
  boxShadow: 'none',
  '&:hover': {
    bgcolor: TOKENS.brandHover,
    boxShadow: '0 4px 12px rgba(76, 217, 100, 0.3)',
  },
  '&.Mui-disabled': {
    bgcolor: TOKENS.border,
    color: TOKENS.textMuted,
  },
};

// Secondary (outlined neutral). For Cancel-style actions.
export const SECONDARY_BUTTON_SX: SxProps<Theme> = {
  ...BUTTON_BASE,
  px: 2,
  color: TOKENS.textSecondary,
  border: `1px solid ${TOKENS.border}`,
  bgcolor: 'transparent',
  '&:hover': {
    bgcolor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
};
