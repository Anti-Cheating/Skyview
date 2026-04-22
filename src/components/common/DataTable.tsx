/**
 * DataTable — shared Skyview table, tuned to the Vercel / Linear /
 * Supabase "Team members" look:
 *   - Transparent header row, 40px tall, hairline below
 *   - Edge-aware horizontal padding (24px outer, 16px inner)
 *   - Hairline inter-row dividers, subtle neutral hover tint
 *   - Skeleton rows on load (not a spinner)
 *   - Row-action columns fade in on hover via `showOnHover`
 *
 * Every list view in Skyview (members, invitations, sessions, future
 * catalogs) should lean on this instead of rolling its own markup.
 */

import {
  Box,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { ReactNode } from 'react';
import { Body, Caption } from '../layout/Typography';
import { TOKENS } from '../../theme';

export type ColumnAlign = 'left' | 'right' | 'center';

export interface DataTableColumn<TRow> {
  /** Stable identifier — used as React key for the column. */
  key: string;
  /** Column header rendered in the <thead>. */
  header: ReactNode;
  /** Cell renderer. Pure function of the row. */
  render: (row: TRow, index: number) => ReactNode;
  align?: ColumnAlign;
  /** Fixed column width, e.g. `120px` or `20%`. */
  width?: string | number;
  /** Hide at breakpoints. "mobile" hides < md. */
  hideOn?: 'mobile';
  /** Fade the cell in only while the row is hovered (row actions). */
  showOnHover?: boolean;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  /** Must be stable across renders — row-level React key. */
  rowKey: (row: TRow, index: number) => string;
  /** Swap the table body for skeleton rows while `loading && rows.length === 0`. */
  loading?: boolean;
  /** Rendered in place of the tbody when `rows.length === 0`. */
  emptyState?: ReactNode;
  /** Optional label shown in a cap above the table (e.g., "Pending invitations"). */
  caption?: ReactNode;
  /** Optional secondary content in the caption row (count pill, filters). */
  captionExtra?: ReactNode;
  /** Fallback zero-data copy when no `emptyState` is provided. */
  emptyText?: string;
  /** Number of skeleton rows to render while loading. */
  loadingRowCount?: number;
}

// Padding constants — outer edge gets 24px, inner cells 16px (Vercel).
const CELL_PX_INNER = 2;
const CELL_PX_EDGE = 3;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 52;
// Hover bg — neutral near-white that sits between bgCard (#FFFFFF) and
// bg (#F8F9FA). Slightly cooler than pure gray, matches our theme.
const HOVER_BG = '#F7F8FA';

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  caption,
  captionExtra,
  emptyText = 'No records yet.',
  loadingRowCount = 4,
}: DataTableProps<TRow>) {
  const isLoadingFirstPaint = loading && rows.length === 0;

  const edgePadding = (idx: number) => ({
    pl: idx === 0 ? CELL_PX_EDGE : CELL_PX_INNER,
    pr: idx === columns.length - 1 ? CELL_PX_EDGE : CELL_PX_INNER,
  });

  const headerCellSx = (col: DataTableColumn<TRow>, idx: number) => ({
    ...(col.width != null ? { width: col.width } : null),
    ...(col.hideOn === 'mobile'
      ? { display: { xs: 'none', md: 'table-cell' } }
      : null),
    ...edgePadding(idx),
    height: HEADER_HEIGHT,
    py: 0,
    color: TOKENS.textSecondary,
    fontWeight: 500,
    fontSize: '0.8125rem', // 13px, sentence case
    letterSpacing: 0,
    textTransform: 'none' as const,
    borderBottom: `1px solid ${TOKENS.border}`,
    bgcolor: 'transparent',
    whiteSpace: 'nowrap' as const,
  });

  const bodyCellSx = (col: DataTableColumn<TRow>, idx: number, isLastRow: boolean) => ({
    ...(col.hideOn === 'mobile'
      ? { display: { xs: 'none', md: 'table-cell' } }
      : null),
    ...edgePadding(idx),
    py: 1.25,
    borderBottom: isLastRow ? 'none' : `1px solid ${TOKENS.borderLight}`,
    fontSize: '0.875rem',
    color: TOKENS.textPrimary,
    verticalAlign: 'middle',
    ...(col.showOnHover
      ? {
          '& > .row-action': {
            opacity: 0,
            transition: 'opacity 120ms ease',
          },
        }
      : null),
  });

  const rowSx = {
    height: ROW_HEIGHT,
    transition: 'background-color 100ms ease',
    '&:hover': { bgcolor: HOVER_BG },
    '&:hover .row-action': { opacity: 1 },
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: TOKENS.border,
        borderRadius: '12px !important',
        bgcolor: TOKENS.bgCard,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      {(caption || captionExtra) && (
        <Box
          sx={{
            px: CELL_PX_EDGE,
            py: 1.5,
            borderBottom: `1px solid ${TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          {caption ? <Body sx={{ fontWeight: 600 }}>{caption}</Body> : <Box />}
          {captionExtra && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>{captionExtra}</Box>
          )}
        </Box>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ height: HEADER_HEIGHT }}>
              {columns.map((col, idx) => (
                <TableCell
                  key={col.key}
                  align={col.align ?? 'left'}
                  sx={headerCellSx(col, idx)}
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoadingFirstPaint ? (
              Array.from({ length: loadingRowCount }).map((_, rIdx) => (
                <TableRow key={`skeleton-${rIdx}`} sx={{ height: ROW_HEIGHT }}>
                  {columns.map((col, cIdx) => (
                    <TableCell
                      key={col.key}
                      align={col.align ?? 'left'}
                      sx={bodyCellSx(col, cIdx, rIdx === loadingRowCount - 1)}
                    >
                      {cIdx === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Skeleton
                            variant="circular"
                            width={28}
                            height={28}
                            sx={{ bgcolor: '#EEF0F3' }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Skeleton
                              variant="text"
                              width={140}
                              height={14}
                              sx={{ bgcolor: '#EEF0F3' }}
                            />
                            <Skeleton
                              variant="text"
                              width={180}
                              height={12}
                              sx={{ bgcolor: '#F3F4F6' }}
                            />
                          </Box>
                        </Box>
                      ) : (
                        <Skeleton
                          variant="rounded"
                          width={cIdx === columns.length - 1 ? 24 : 80}
                          height={cIdx === columns.length - 1 ? 24 : 14}
                          sx={{ bgcolor: '#EEF0F3', borderRadius: '6px' }}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{ borderBottom: 'none', p: 0 }}
                >
                  <Box sx={{ py: 7, px: 3, textAlign: 'center' }}>
                    {emptyState ?? (
                      <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
                        {emptyText}
                      </Caption>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={rowKey(row, index)} sx={rowSx}>
                  {columns.map((col, cIdx) => (
                    <TableCell
                      key={col.key}
                      align={col.align ?? 'left'}
                      sx={bodyCellSx(col, cIdx, index === rows.length - 1)}
                    >
                      {col.showOnHover ? (
                        <Box component="span" className="row-action">
                          {col.render(row, index)}
                        </Box>
                      ) : (
                        col.render(row, index)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
