/**
 * TruoyyLogo — brand wordmark, asset-backed.
 *
 * Two variants because the underlying SVG bakes the text colour:
 *   - `truoyy-logo.svg`      → light letters (for dark surfaces: sidebar)
 *   - `truoyy-logo-dark.svg` → dark letters  (for light surfaces: invite card)
 *
 * The green eye graphic is identical in both. Consumers pick explicitly
 * via the `variant` prop, or leave it auto for the default light-on-dark
 * use case (sidebar).
 */

import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import logoLight from '../../assets/svgviewer-output.svg';       // white text → dark bg
import logoDark from '../../assets/svgviewer-output-dark.svg';   // dark text  → light bg

interface TruoyyLogoProps {
  collapsed?: boolean;
  size?: 'small' | 'medium' | 'large';
  /** Pick the text colour baked into the asset. */
  variant?: 'light' | 'dark';
  sx?: SxProps<Theme>;
}

// Heights tuned for the new wider wordmark (~4.16:1).
//   small  → tight/compact spots
//   medium → sidebar header + mobile app header (kept modest so it doesn't dominate)
//   large  → login / auth hero panels, which have room for a bigger mark
const HEIGHT_BY_SIZE: Record<NonNullable<TruoyyLogoProps['size']>, number> = {
  small: 22,
  medium: 28,
  large: 40,
};

export function TruoyyLogo({
  collapsed = false,
  size = 'medium',
  variant = 'light',
  sx,
}: TruoyyLogoProps) {
  const logoHeight = collapsed ? 26 : HEIGHT_BY_SIZE[size];
  const src = variant === 'dark' ? logoDark : logoLight;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sx,
      }}
    >
      <img
        src={src}
        alt="Trueyy"
        style={{
          height: logoHeight,
          width: 'auto',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </Box>
  );
}
