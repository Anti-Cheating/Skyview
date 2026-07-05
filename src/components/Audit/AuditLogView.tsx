import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, MenuItem, Select, TextField, Tooltip, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { AuditListItem, AuditListQuery } from '../../services/audit.service';

/** Action catalog for the filter dropdown, grouped roughly by module.
 *  Kept in sync with Cortex's audit() call sites — an unknown action still
 *  renders fine, this only feeds the dropdown. */
export const AUDIT_ACTIONS: string[] = [
  'auth.login', 'auth.login_failed', 'auth.signup', 'auth.desktop_code_issue',
  'auth.desktop_login', 'auth.password_reset_request', 'auth.password_reset',
  'session.create', 'session.update', 'session.cancel', 'session.activate', 'session.deactivate',
  'interview.create', 'interview.update', 'interview.cancel', 'interview.add_round',
  'analysis.run', 'report.export',
  'consent.given', 'consent.declined', 'consent.revoked',
  'user.invite', 'user.invite_accept', 'user.invite_revoke', 'user.update',
  'api_token.create', 'api_token.revoke', 'session_token.mint',
  'webhook.create', 'webhook.update', 'webhook.revoke', 'webhook.rotate_secret', 'webhook.refire_delivery',
  'subscription.create', 'subscription.activate', 'subscription.cancel',
  'company.update', 'company.billing_contact_update',
  // Super-admin-only actions (never returned by the customer endpoint):
  'company.suspend', 'company.quota_adjust', 'license.issue', 'license.topup',
  'license.suspend', 'license.charge', 'enterprise.onboard', 'admin.bootstrap',
  'plan.create', 'plan.update', 'rotate_url',
];

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString() : '—');

const stringifyDetails = (d: unknown): string => {
  if (d === null || d === undefined) return '';
  try { return JSON.stringify(d); } catch { return String(d); }
};

export function ActionChip({ action }: { action: string }) {
  return (
    <Chip
      label={action}
      size="small"
      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: TOKENS.brandBg, color: '#047857' }}
    />
  );
}

interface AuditLogViewProps {
  title: string;
  subtitle: string;
  /** Data source — AdminService.audit or CompanyAuditService.list. */
  fetchPage: (q: AuditListQuery) => Promise<{ items: AuditListItem[]; total: number }>;
  /** Row click → detail page navigation. */
  onOpen: (row: AuditListItem) => void;
  /** Super-admin view shows the company column. */
  showCompany?: boolean;
  /** Restrict the dropdown to customer-visible actions. */
  customerActions?: boolean;
}

const CUSTOMER_HIDDEN = new Set([
  'company.suspend', 'company.quota_adjust', 'license.issue', 'license.topup',
  'license.suspend', 'license.charge', 'enterprise.onboard', 'admin.bootstrap',
  'plan.create', 'plan.update', 'auth.login_failed',
]);

export default function AuditLogView({
  title, subtitle, fetchPage, onOpen, showCompany = false, customerActions = false,
}: AuditLogViewProps) {
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<AuditListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  // Applied search — debounced from `search` so we don't refetch per
  // keystroke; Enter applies immediately.
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch((prev) => {
        const next = search.trim();
        if (next !== prev) setPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const actionOptions = useMemo(
    () => (customerActions ? AUDIT_ACTIONS.filter((a) => !CUSTOMER_HIDDEN.has(a)) : AUDIT_ACTIONS),
    [customerActions],
  );

  useEffect(() => {
    setLoading(true);
    fetchPage({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(action ? { action } : {}),
      ...(appliedSearch ? { search: appliedSearch } : {}),
    })
      .then((r) => { setRows(r.items ?? []); setTotal(r.total ?? 0); })
      .catch((e: unknown) => showError((e as Error)?.message || 'Failed to load audit log'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, action, appliedSearch]);

  const applySearch = () => { setPage(1); setAppliedSearch(search.trim()); };

  const columns = useMemo<DataTableColumn<AuditListItem>[]>(() => {
    const cols: DataTableColumn<AuditListItem>[] = [
      { key: 'action', header: 'Action', width: 200, render: (a) => <ActionChip action={a.action} /> },
    ];
    if (showCompany) {
      cols.push({
        key: 'company', header: 'Company', hideOn: 'mobile',
        render: (a) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{a.company_name ?? a.company_id ?? '—'}</Caption>,
      });
    }
    cols.push(
      {
        key: 'actor', header: 'Actor', hideOn: 'mobile',
        render: (a) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
              {a.actor_name ?? a.user_name ?? a.actor_id ?? a.user_id ?? 'system'}
            </Caption>
            {a.actor_role && (
              <Chip label={a.actor_role} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
            )}
          </Box>
        ),
      },
      {
        key: 'entity', header: 'Entity', hideOn: 'mobile',
        render: (a) => (
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
            {a.entity_type ? `${a.entity_type}${a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ''}` : '—'}
          </Caption>
        ),
      },
      { key: 'when', header: 'When', width: 170, render: (a) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(a.created_at)}</Caption> },
      {
        key: 'details', header: 'Details',
        render: (a) => {
          const details = stringifyDetails(a.details);
          return (
            <Tooltip title={details}>
              <Box sx={{ maxWidth: 280, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {details.length > 70 ? `${details.slice(0, 70)}…` : details || '—'}
              </Box>
            </Tooltip>
          );
        },
      },
    );
    return cols;
  }, [showCompany]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>{title}</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>{subtitle}</Secondary>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search action, entity, or user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: TOKENS.textSecondary }} />
              </InputAdornment>
            ),
          }}
        />
        <Select
          size="small"
          displayEmpty
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          sx={{ minWidth: 220 }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
        >
          <MenuItem value="">All actions</MenuItem>
          {actionOptions.map((a) => (
            <MenuItem key={a} value={a}>{a}</MenuItem>
          ))}
        </Select>
      </Box>

      <DataTable<AuditListItem>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No audit entries."
        onRowClick={(r) => onOpen(r)}
        pagination={{
          page, pageSize, total,
          onChange: (p, sz) => { setPage(p); setPageSize(sz); },
        }}
      />
    </Box>
  );
}
