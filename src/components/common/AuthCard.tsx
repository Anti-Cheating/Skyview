/**
 * AuthCard — split-viewport auth shell.
 *
 *   ┌──────────────────────┬───────────────────┐
 *   │ LIGHT gradient side   │ white form card   │
 *   │ logo · 2-tone headline│  logo · form      │
 *   │ · subline · features  │                   │
 *   └──────────────────────┴───────────────────┘
 *
 * Layout:
 *   - md+ (≥ 900px): split panel; left 45% is a soft pastel gradient
 *     brand side, right 55% holds the white form card. Logo hides
 *     inside the card (the sidebar already shows it).
 *   - xs / sm: sidebar collapses, form card renders full-width centered
 *     with the logo back inside it.
 *
 * Animation:
 *   - The sidebar gradient slowly drifts across a 400% virtual canvas
 *     (≈ 24s loop). Subtle, doesn't call attention to itself — just
 *     enough that the page feels alive.
 *
 * The form card visual is unchanged.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Paper } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { TruoyyLogo } from '../layout/TruoyyLogo';
import { TOKENS } from '../../theme';

// Module-scoped — survives component unmounts. Lets us tell "this is the
// very first AuthCard mount in this session" apart from "user clicked
// Sign in / Sign up so we navigated between two AuthCard routes". The
// flip should only play in the second case.
let lastAuthPathname: string | null = null;

export interface AuthCardProps {
  children: React.ReactNode;
  /** Max width of the card in pixels (default 440). */
  maxWidth?: number;
  /** Hide the logo — for error/confirmation variants that render their own. */
  hideLogo?: boolean;
  /** Extra sx applied to the inner Paper, not the outer shell. */
  cardSx?: SxProps<Theme>;
}

const HEADLINE_PRIMARY = 'Interviews you can';
// Words cycled on the second line. Total cycle = words.length * WORD_HOLD_SEC
// seconds; each word gets ~20% of the loop (fade-in / dwell / fade-out).
const HEADLINE_ACCENT_WORDS = ['trust.', 'verify.', 'believe in.', 'rely on.', 'defend.'];
const WORD_HOLD_SEC = 2;
const SUBLINE =
  'Full visibility in every interview. Full confidence in every hire.';

export function AuthCard({
  children,
  maxWidth = 440,
  // hideLogo retained on the public type for API compatibility — the
  // logo now lives in the BrandMobileBanner / BrandSidebar siblings,
  // never inside the card itself, so the prop is a no-op.
  hideLogo: _hideLogo = false,
  cardSx,
}: AuthCardProps) {
  const { pathname } = useLocation();

  // Only flip when the user is moving BETWEEN auth routes (e.g. sign-in
  // → sign-up). First mount (hard reload, deep link) has no prior
  // pathname in module scope, so we skip the animation.
  const [shouldFlip] = useState(
    () => lastAuthPathname !== null && lastAuthPathname !== pathname
  );

  useEffect(() => {
    lastAuthPathname = pathname;
  }, [pathname]);

  const flipAnimationSx = shouldFlip
    ? {
        transformOrigin: 'center center',
        transformStyle: 'preserve-3d' as const,
        backfaceVisibility: 'hidden' as const,
        animation: 'authCardFlip 520ms cubic-bezier(0.2, 0.8, 0.25, 1) both',
        '@keyframes authCardFlip': {
          '0%':   { opacity: 0, transform: 'rotateY(-90deg)' },
          '55%':  { opacity: 0.75 },
          '100%': { opacity: 1, transform: 'rotateY(0deg)' },
        },
      }
    : null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: TOKENS.bg,
      }}
    >
      <BrandSidebar />
      {/* No mobile brand banner — the form is the hero on phones.
          Logo lives inside the card on mobile (re-added below). */}

      <Box
        sx={{
          flex: { xs: '1 1 auto', md: '1 1 55%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          py: { xs: 3, md: 5 },
          // 3D context needed only when the flip is active — harmless to
          // leave on always, but it documents the intent.
          perspective: shouldFlip ? '1400px' : undefined,
        }}
      >
        <Paper
          variant="outlined"
          sx={[
            {
              p: { xs: 3, sm: 4 },
              width: '100%',
              maxWidth,
              borderRadius: '16px !important',
              borderColor: TOKENS.border,
              bgcolor: TOKENS.bgCard,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
              ...flipAnimationSx,
            },
            ...(Array.isArray(cardSx) ? cardSx : cardSx ? [cardSx] : []),
          ]}
        >
          {!_hideLogo && (
            // Mobile: surface the logo inside the card so the brand is
            // present without spending a dark hero strip on it. Desktop
            // hides this because BrandSidebar already shows it.
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <TruoyyLogo collapsed={false} size="medium" variant="dark" />
            </Box>
          )}
          {children}
        </Paper>
      </Box>
    </Box>
  );
}

// ── Brand sidebar (desktop-only) ────────────────────────────────────────

function BrandSidebar() {
  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '1 1 45%',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { md: 5, lg: 7 },
        position: 'relative',
        overflow: 'hidden',

        // Solid Trueyy dark (#0B1A10) base, with a very subtle drifting
        // green accent layered on top so the pane isn't dead flat.
        bgcolor: TOKENS.sidebar,
        backgroundImage:
          'linear-gradient(135deg, rgba(76,217,100,0.10) 0%, rgba(76,217,100,0.02) 50%, rgba(76,217,100,0.08) 100%)',
        backgroundSize: '400% 400%',
        animation: 'authGradientShift 24s ease-in-out infinite',

        '@keyframes authGradientShift': {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },

        // Slow breathing glow (used by the decorative halo below)
        '@keyframes authHaloBreathe': {
          '0%, 100%': { opacity: 0.45, transform: 'translate(-50%, -50%) scale(1)' },
          '50%':      { opacity: 0.75, transform: 'translate(-50%, -50%) scale(1.12)' },
        },

        // Honour OS-level "Reduce motion" — kill drifts, halos, and
        // word-rotator animations for vestibular-sensitive users.
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          '& *, & *::before, & *::after': {
            animation: 'none !important',
            transition: 'none !important',
          },
        },
      }}
    >
      {/* Soft green halo breathing behind the hero text — subtle depth */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: '52%',
          left: '38%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(76,217,100,0.18) 0%, rgba(76,217,100,0.05) 45%, transparent 70%)',
          animation: 'authHaloBreathe 6s ease-in-out infinite',
          pointerEvents: 'none',
          filter: 'blur(2px)',
        }}
      />

      {/* Logo — pinned top-left. Negative margin-left cancels the SVG's
          baked-in left padding so the "T" is flush with the headline. */}
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex' }}>
        <TruoyyLogo collapsed={false} size="medium" variant="light" />
      </Box>

      {/* Hero block — vertically centered via space-between flex */}
      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 520 }}>
        {/* 2-tone headline. Second line cycles through the accent words. */}
        <Box
          sx={{
            fontSize: { md: '2.25rem', lg: '2.75rem' },
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            mb: 2.5,
          }}
        >
          <Box component="span" sx={{ color: '#FFFFFF', display: 'block' }}>
            {HEADLINE_PRIMARY}
          </Box>
          <RotatingAccent />
        </Box>

        {/* Subline */}
        <Box
          sx={{
            fontSize: { md: '0.9375rem', lg: '1rem' },
            lineHeight: 1.65,
            color: 'rgba(255, 255, 255, 0.62)',
            maxWidth: 460,
            mb: 4,
          }}
        >
          {SUBLINE}
        </Box>
      </Box>

      {/* Footer — small copyright */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          fontSize: '0.6875rem',
          color: 'rgba(255, 255, 255, 0.4)',
          letterSpacing: '0.02em',
        }}
      >
        © {new Date().getFullYear()} Trueyy. All rights reserved.
      </Box>
    </Box>
  );
}

// ── Rotating accent word (second line of the sidebar headline) ──────────
//
// Stacks every word in the same CSS grid cell so only one is ever visible,
// then cycles visibility via a shared keyframe with staggered delays.
// Pure CSS — no JS timer, no library.

function RotatingAccent() {
  const cycle = WORD_HOLD_SEC * HEADLINE_ACCENT_WORDS.length; // total loop (s)

  return (
    <Box
      sx={{
        display: 'grid',
        // Every child occupies the same cell → they stack on top of
        // each other. The grid's natural width/height is set by the
        // widest / tallest word, which stays consistent across the cycle.
        '& > *': { gridColumn: 1, gridRow: 1 },
        color: TOKENS.brand,
        fontStyle: 'italic',
      }}
    >
      {HEADLINE_ACCENT_WORDS.map((word, i) => (
        <Box
          key={word}
          component="span"
          sx={{
            opacity: 0,
            transform: 'translateY(6px)',
            animation: `accentWordCycle ${cycle}s ease-in-out infinite`,
            animationDelay: `${i * WORD_HOLD_SEC}s`,
            willChange: 'opacity, transform',
            // Each word is visible for ~20% of the loop (5 words) — the
            // percentages below are what one 20% slot looks like: fade
            // in, dwell, fade out. After 26% we're invisible until the
            // next loop.
            '@keyframes accentWordCycle': {
              '0%':   { opacity: 0, transform: 'translateY(6px)' },
              '4%':   { opacity: 1, transform: 'translateY(0)' },
              '18%':  { opacity: 1, transform: 'translateY(0)' },
              '22%':  { opacity: 0, transform: 'translateY(-6px)' },
              '100%': { opacity: 0, transform: 'translateY(-6px)' },
            },
            // Reduced-motion fallback: the first word stays visible, the
            // rest are hidden. No fades, no transforms — but the brand
            // panel still reads as "Interviews you can trust."
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              opacity: i === 0 ? 1 : 0,
              transform: 'none',
              display: i === 0 ? 'inline' : 'none',
            },
          }}
        >
          {word}
        </Box>
      ))}
    </Box>
  );
}
