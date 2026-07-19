import { TextField, InputAdornment, type SxProps, type Theme } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';

export interface SearchFieldProps {
  value: string;
  /** Receives the raw string value (not the event) — call setState directly. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** e.g. apply-on-Enter: (e) => { if (e.key === 'Enter') apply(); } */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Stretch to the container instead of the default responsive width. */
  fullWidth?: boolean;
  autoFocus?: boolean;
  /** Override the default width ({ xs: '100%', sm: 280 }). */
  width?: number | string | Record<string, number | string>;
  /** Merged onto the root — for margins/min-width tweaks per caller. */
  sx?: SxProps<Theme>;
}

/**
 * The one search input for the whole app. Standardises the design used in
 * the Interviews "By round" list: rounded outline, subtle grey border that
 * warms to the brand colour on focus, leading search glyph.
 */
export function SearchField({
  value, onChange, placeholder = 'Search…', onKeyDown, fullWidth, autoFocus, width, sx,
}: SearchFieldProps) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      fullWidth={fullWidth}
      autoFocus={autoFocus}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
          </InputAdornment>
        ),
      }}
      sx={{
        width: fullWidth ? undefined : (width ?? { xs: '100%', sm: 280 }),
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          fontSize: '0.875rem',
          bgcolor: '#FFFFFF',
          '& fieldset': { borderColor: '#E5E7EB' },
          '&:hover fieldset': { borderColor: '#D1D5DB' },
          '&.Mui-focused fieldset': { borderColor: TOKENS.brand, borderWidth: 1 },
        },
        ...sx,
      }}
    />
  );
}
