import { Fragment } from 'react';
import { Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { TOKENS } from '../../theme';

export interface Crumb {
  label: string;
  /** Omit on the last (current) crumb so it renders as plain text. */
  to?: string;
}

/**
 * Shared breadcrumb shown at the top of every page. Parents are clickable
 * links; the final crumb is the current page (bold, non-link).
 *   Dashboard › Interviews › John Doe · SDE-1 › Round 2 · Managerial
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.25,
        fontSize: '0.8125rem',
        mb: 2,
      }}
    >
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {c.to && !last ? (
              <Box
                component={Link}
                to={c.to}
                sx={{
                  color: TOKENS.textSecondary,
                  textDecoration: 'none',
                  '&:hover': { color: TOKENS.textPrimary },
                }}
              >
                {c.label}
              </Box>
            ) : (
              <Box component="span" sx={{ color: last ? TOKENS.textPrimary : TOKENS.textSecondary, fontWeight: last ? 600 : 400 }}>
                {c.label}
              </Box>
            )}
            {!last && <Box component="span" sx={{ mx: 0.75, color: '#C4C9D1' }}>›</Box>}
          </Fragment>
        );
      })}
    </Box>
  );
}
