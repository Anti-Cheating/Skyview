/**
 * DataTable — antd-styled table primitive in Trueyy colours.
 *
 * Minimal antd visual language:
 *   - Light gray header bg (#FAFAFA), bold near-black header text
 *   - Hairline row borders, subtle hover tint
 *   - Sticky header on scroll (set `maxBodyHeight`)
 *   - Compact pagination footer: count + prev/page/next, no size selector
 *   - Row-actions column slot (`showOnHover`) reveals on row hover
 *   - Skeleton rows while loading; centered empty state otherwise
 *
 * Sort UI was intentionally dropped — most lists in Trueyy already have
 * a sensible server-side default order, and adding click-to-sort just
 * adds chrome users don't reach for.
 *
 * Pagination is "controlled" — caller owns `page` / `pageSize` state
 * and reacts to `onChange`. The table only renders the controls. This
 * lets the caller decide between client-side paging (slice the rows)
 * or server-side (fetch a new page on each change).
 */

import {
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { Body, Caption } from '../layout/Typography';
import { TOKENS } from '../../theme';

// Motion-enhanced TableRow used for animating rows in/out when the
// caller's filter / search / page changes. We deliberately don't apply
// `layout` here — `<tr>` doesn't honour CSS transforms reliably across
// browsers (`display: table-row` is the gotcha), so reorder animations
// on tables get janky. The card-grid path in AppInterviewList uses
// full layout animation since `<div>` transforms work fine.
const MotionTableRow = motion.create(TableRow);

export type ColumnAlign = 'left' | 'right' | 'center';

export interface DataTableColumn<TRow> {
  key: string;
  header: ReactNode;
  render: (row: TRow, index: number) => ReactNode;
  align?: ColumnAlign;
  width?: string | number;
  hideOn?: 'mobile';
  showOnHover?: boolean;
}

export interface DataTablePagination {
  page: number;        // 1-based
  pageSize: number;
  total: number;       // total row count across all pages
  /** Antd-style size options. Defaults to [10, 20, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the size dropdown entirely (e.g., when only one size makes sense). */
  showSizeChanger?: boolean;
  /** Fired on page change OR size change. Caller distinguishes by comparing. */
  onChange: (page: number, pageSize: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow, index: number) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  caption?: ReactNode;
  captionExtra?: ReactNode;
  emptyText?: string;
  loadingRowCount?: number;
  pagination?: DataTablePagination;
  /** Set to enable sticky header — body scrolls inside this height. */
  maxBodyHeight?: number | string;
  /** Makes rows clickable (pointer cursor) — e.g. navigate to a detail page. */
  onRowClick?: (row: TRow, index: number) => void;
}

// Antd table dimensions, in our tokens.
const HEADER_BG     = '#FAFAFA';
const HEADER_BORDER = '#F0F0F0';
const ROW_BORDER    = '#F0F0F0';
const HOVER_BG      = '#FAFAFA';
const HEADER_HEIGHT = 44;
const ROW_HEIGHT    = 52;
const CELL_PX_INNER = 2;
const CELL_PX_EDGE  = 3;

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  caption,
  captionExtra,
  emptyText = 'No data',
  loadingRowCount = 5,
  pagination,
  maxBodyHeight,
  onRowClick,
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
    color: '#1F2937',
    fontWeight: 600,
    fontSize: '0.8125rem',
    letterSpacing: 0,
    textTransform: 'none' as const,
    bgcolor: HEADER_BG,
    borderBottom: `1px solid ${HEADER_BORDER}`,
    whiteSpace: 'nowrap' as const,
    // Sticky header — only applies when maxBodyHeight is set on the
    // container, but harmless otherwise (sticky needs an overflow
    // ancestor to take effect).
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
  });

  const bodyCellSx = (col: DataTableColumn<TRow>, idx: number, isLastRow: boolean) => ({
    ...(col.hideOn === 'mobile'
      ? { display: { xs: 'none', md: 'table-cell' } }
      : null),
    ...edgePadding(idx),
    py: 1.25,
    borderBottom: isLastRow ? 'none' : `1px solid ${ROW_BORDER}`,
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

  const renderPagination = () => {
    if (!pagination) return null;
    const {
      page,
      pageSize,
      total,
      onChange,
      pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
      showSizeChanger = true,
    } = pagination;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(total, page * pageSize);

    const goTo = (next: number) => {
      const clamped = Math.max(1, Math.min(totalPages, next));
      if (clamped !== page) onChange(clamped, pageSize);
    };
    const changeSize = (next: number) => {
      // Reset to page 1 on size change so the user doesn't land on
      // an empty page when shrinking the view (and matches antd
      // behaviour). Caller can react to the new size by reissuing
      // the API call with the new limit.
      if (next !== pageSize) onChange(1, next);
    };

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: CELL_PX_EDGE,
          py: 1,
          borderTop: `1px solid ${HEADER_BORDER}`,
          bgcolor: '#FFFFFF',
          flexWrap: 'wrap',
        }}
      >
        {/* Was #6B7280 on white = 4.5:1 (AA pass for body, fails AAA).
            Bumped to #4B5563 (~7:1) so the count + page indicator stay
            legible at the small 13px size used here. */}
        <Caption sx={{ color: '#4B5563', fontSize: '0.8125rem' }}>
          {total === 0 ? 'No items' : `${startItem}-${endItem} of ${total} items`}
        </Caption>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconButton
            size="small"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
            sx={{
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              width: 28,
              height: 28,
              color: TOKENS.textSecondary,
              transition: 'border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
              '&:hover': {
                bgcolor: 'transparent',
                borderColor: '#D1D5DB',
                color: TOKENS.textPrimary,
              },
              '&:focus-visible': {
                outline: 'none',
                borderColor: TOKENS.brand,
                boxShadow: '0 0 0 3px rgba(76, 217, 100, 0.14)',
              },
              '&.Mui-disabled': { borderColor: TOKENS.border, color: '#D1D5DB' },
            }}
          >
            <ChevronLeft sx={{ fontSize: 16 }} />
          </IconButton>
          <Box
            sx={{
              fontSize: '0.8125rem',
              // Was #374151; #1F2937 (textPrimary) bumps the contrast on
              // the page indicator to ~12:1 since this is the navigation
              // anchor between the prev/next buttons and should read as
              // the primary control, not muted helper text.
              color: '#1F2937',
              fontWeight: 500,
              minWidth: 70,
              textAlign: 'center',
            }}
          >
            Page {page} of {totalPages}
          </Box>
          <IconButton
            size="small"
            disabled={page >= totalPages}
            onClick={() => goTo(page + 1)}
            sx={{
              border: `1px solid ${TOKENS.border}`,
              borderRadius: '8px',
              width: 28,
              height: 28,
              color: TOKENS.textSecondary,
              transition: 'border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
              '&:hover': {
                bgcolor: 'transparent',
                borderColor: '#D1D5DB',
                color: TOKENS.textPrimary,
              },
              '&:focus-visible': {
                outline: 'none',
                borderColor: TOKENS.brand,
                boxShadow: '0 0 0 3px rgba(76, 217, 100, 0.14)',
              },
              '&.Mui-disabled': { borderColor: TOKENS.border, color: '#D1D5DB' },
            }}
          >
            <ChevronRight sx={{ fontSize: 16 }} />
          </IconButton>
          {showSizeChanger && pageSizeOptions.length > 1 && (
            <Select
              size="small"
              value={pageSize}
              onChange={(e) => changeSize(Number(e.target.value))}
              MenuProps={{
                // Match the app's surface treatment: 8px corners, soft
                // shadow, brand-green hover/selected tint. Otherwise
                // MUI ships a default popover that looks foreign next
                // to ActionButton + FormField.
                PaperProps: {
                  sx: {
                    mt: 0.5,
                    borderRadius: '8px',
                    border: `1px solid ${TOKENS.border}`,
                    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.10)',
                    '& .MuiMenuItem-root': {
                      fontSize: '0.8125rem',
                      color: TOKENS.textPrimary,
                      borderRadius: '6px',
                      mx: 0.5,
                      my: 0.25,
                      '&:hover': {
                        bgcolor: 'rgba(76, 217, 100, 0.08)',
                        color: '#047857',
                      },
                      '&.Mui-selected, &.Mui-selected:hover': {
                        bgcolor: 'rgba(76, 217, 100, 0.14)',
                        color: '#047857',
                        fontWeight: 600,
                      },
                    },
                  },
                },
              }}
              sx={{
                ml: 0.5,
                height: 28,
                fontSize: '0.8125rem',
                color: TOKENS.textPrimary,
                borderRadius: '8px',
                transition: 'box-shadow 120ms ease, border-color 120ms ease',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: TOKENS.border,
                  borderRadius: '8px',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#D1D5DB',
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 3px rgba(76, 217, 100, 0.14)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: TOKENS.brand,
                  borderWidth: '1px',
                },
                '& .MuiSelect-select': {
                  py: 0,
                  pr: '28px !important',
                  pl: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiSelect-icon': {
                  color: TOKENS.textSecondary,
                  right: 6,
                },
              }}
            >
              {pageSizeOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt} / page
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: HEADER_BORDER,
        borderRadius: '8px !important',
        bgcolor: TOKENS.bgCard,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      {(caption || captionExtra) && (
        <Box
          sx={{
            px: CELL_PX_EDGE,
            py: 1.5,
            borderBottom: `1px solid ${HEADER_BORDER}`,
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

      <TableContainer sx={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}>
        <Table size="small" stickyHeader={!!maxBodyHeight}>
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
                      <Skeleton
                        variant="rounded"
                        width={cIdx === columns.length - 1 ? 24 : cIdx === 0 ? 160 : 100}
                        height={14}
                        sx={{ bgcolor: '#EEF0F3', borderRadius: '4px' }}
                      />
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
                      <Caption sx={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>
                        {emptyText}
                      </Caption>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence initial={false}>
                {rows.map((row, index) => (
                  <MotionTableRow
                    key={rowKey(row, index)}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                    sx={onRowClick ? { ...rowSx, cursor: 'pointer' } : rowSx}
                    // Fade-only enter/exit. Skipping layout transforms
                    // on table rows on purpose (see import comment).
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
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
                  </MotionTableRow>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {renderPagination()}
    </Paper>
  );
}
