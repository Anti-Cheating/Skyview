/**
 * TenantDetail — SuperAdmin /admin/tenants/:id
 *
 * Tabbed layout (Linear / Vercel / Notion pattern, same as TeamPage):
 *
 *   Overview · Users · Sessions · API tokens · Webhooks · Invoices · Migrations · Audit log
 *
 * Each tab uses the shared <DataTable> primitive so every list in
 * Skyview shares one set of table styles, empty states, and spacing.
 *
 * V1 tenants (db_url_encrypted IS NULL) live entirely in the shared
 * control-plane DB so every tab has data.
 *
 * V2 tenants (db_url_encrypted IS NOT NULL) keep their *operational*
 * data (users, sessions, api tokens, webhooks) in their own Postgres.
 * Cortex returns `{ is_v2: true, <data>: [] }` for those tabs and the
 * UI shows a "lives in tenant DB" empty state. Control-plane tabs
 * (Invoices, Migrations, Audit log) still work for V2.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Tabs,
  Tab,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import {
  PageTitle, SectionHeading, CardTitle, Body, Caption, Secondary,
} from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { TOKENS } from '../../theme';
import {
  AdminService,
  type AdminTenantDetail,
  type AdminTenantUser,
  type AdminTenantSession,
  type AdminTenantApiToken,
  type AdminTenantWebhookEndpoint,
  type AdminTenantWebhookDelivery,
  type AdminTenantInvoice,
  type AdminTenantMigration,
  type AdminTenantAuditAction,
} from '../../services/admin.service';

// ─── shared bits (kept inline so the file is self-contained) ──────────────
function StatusChip({ status }: { status: string }) {
  const c =
    status === 'active' || status === 'succeeded' || status === 'paid'
      ? { bg: 'rgba(34,197,94,0.12)', fg: '#15803D' }
      : status === 'suspended' || status === 'failed' || status === 'dead_lettered' || status === 'overdue'
      ? { bg: 'rgba(239,68,68,0.12)', fg: '#B91C1C' }
      : status === 'running' || status === 'pending' || status === 'paused'
      ? { bg: 'rgba(234,179,8,0.12)', fg: '#A16207' }
      : { bg: '#F3F4F6', fg: '#4B5563' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
        borderRadius: '6px', bgcolor: c.bg, color: c.fg,
        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1, textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  );
}

function initialsOf(first: string | null, last: string | null, email: string) {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() || '?';
  return (email[0] ?? '?').toUpperCase();
}

function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}
function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString();
}

function V2HintBanner({ tab }: { tab: string }) {
  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
      This workspace uses a self-hosted database. {tab} are stored there and
      not visible from Trueyy admin.
    </Alert>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────
type TabKey =
  | 'overview' | 'users' | 'sessions' | 'tokens' | 'webhooks'
  | 'invoices' | 'migrations' | 'audit';

const TABS: { value: TabKey; label: string }[] = [
  { value: 'overview',   label: 'Overview'    },
  { value: 'users',      label: 'Users'       },
  { value: 'sessions',   label: 'Sessions'    },
  { value: 'tokens',     label: 'API tokens'  },
  { value: 'webhooks',   label: 'Webhooks'    },
  { value: 'invoices',   label: 'Invoices'    },
  { value: 'migrations', label: 'Migrations'  },
  { value: 'audit',      label: 'Audit log'   },
];

export default function TenantDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [tab, setTab] = useState<TabKey>('overview');
  const [t, setT] = useState<AdminTenantDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    if (!id) return;
    AdminService.getTenant(id)
      .then((r) => { setT(r.data as AdminTenantDetail); setErr(null); })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Failed to load tenant'));
  };
  useEffect(reload, [id]);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendBusy, setSuspendBusy] = useState(false);
  const handleSuspend = async () => {
    if (!t) return;
    setSuspendBusy(true);
    try {
      await AdminService.suspend(t.id, suspendReason);
      setSuspendOpen(false);
      setSuspendReason('');
      reload();
    } finally {
      setSuspendBusy(false);
    }
  };
  const handleResume = async () => {
    if (!t) return;
    await AdminService.resume(t.id); reload();
  };

  if (!id) return null;
  if (err) return <Box sx={{ p: 3 }}><Alert severity="error">{err}</Alert></Box>;
  if (!t) return <Box sx={{ p: 3 }}><Secondary>Loading…</Secondary></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ActionButton variant="secondary" onClick={() => navigate('/admin/tenants')} startIcon={<BackIcon />}>
          Back
        </ActionButton>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <PageTitle>{t.name}</PageTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={t.is_v2 ? 'Self-hosted database' : 'Trueyy-hosted'} sx={{ fontWeight: 600 }} />
          <StatusChip status={t.status} />
          {t.status === 'suspended' ? (
            <ActionButton onClick={handleResume}>Resume</ActionButton>
          ) : (
            <ActionButton variant="secondary" onClick={() => setSuspendOpen(true)}>Suspend</ActionButton>
          )}
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as TabKey)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2.5,
          minHeight: 36,
          borderBottom: `1px solid ${TOKENS.border}`,
          '& .MuiTabs-flexContainer': { gap: 2.5 },
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            minHeight: 36,
            px: 0,
            py: 1,
            minWidth: 0,
            color: TOKENS.textSecondary,
            '&:hover': { color: TOKENS.textPrimary },
          },
          '& .Mui-selected': { color: `${TOKENS.textPrimary} !important`, fontWeight: 600 },
          '& .MuiTabs-indicator': { backgroundColor: TOKENS.brand, height: 2 },
        }}
      >
        {TABS.map((tt) => (
          <Tab key={tt.value} value={tt.value} label={tt.label} />
        ))}
      </Tabs>

      {tab === 'overview'   && <OverviewPane t={t} />}
      {tab === 'users'      && <UsersTab id={t.id} />}
      {tab === 'sessions'   && <SessionsTab id={t.id} />}
      {tab === 'tokens'     && <TokensTab id={t.id} />}
      {tab === 'webhooks'   && <WebhooksTab id={t.id} />}
      {tab === 'invoices'   && <InvoicesTab id={t.id} />}
      {tab === 'migrations' && <MigrationsTab id={t.id} />}
      {tab === 'audit'      && <AuditTab id={t.id} />}

      <Dialog
        open={suspendOpen}
        onClose={() => !suspendBusy && setSuspendOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Suspend {t.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Secondary>
              All API requests from this company will return 402 Payment Required until resumed.
            </Secondary>
            <FormField
              label="Reason (optional)"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              multiline minRows={2}
              disabled={suspendBusy}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => setSuspendOpen(false)}
            disabled={suspendBusy}
          >
            Cancel
          </ActionButton>
          <ActionButton onClick={handleSuspend} loading={suspendBusy}>
            Suspend
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────
function OverviewPane({ t }: { t: AdminTenantDetail }) {
  const stats: { label: string; value: React.ReactNode }[] = [
    { label: 'Plan',         value: <Body sx={{ textTransform: 'capitalize' }}>{t.plan}</Body> },
    { label: 'Plan limit',   value: <Body>{t.plan_limit}</Body> },
    { label: 'Used',         value: <Body>{t.sessions_used_month}</Body> },
    { label: 'Cap policy',   value: <Body sx={{ textTransform: 'capitalize' }}>{t.cap_policy}</Body> },
    { label: 'Invoices',     value: <Body>{t.invoice_count}</Body> },
    { label: 'Database',     value: <Body>{t.is_v2 ? 'Self-hosted database' : 'Trueyy-hosted'}</Body> },
    { label: 'Created',      value: <Body>{fmtDate(t.created_at)}</Body> },
    { label: 'Company id',   value: <Caption sx={{ fontFamily: 'monospace' }}>{t.id}</Caption> },
  ];
  return (
    <Box>
      <SectionHeading sx={{ mb: 2 }}>Overview</SectionHeading>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        {stats.map((s) => (
          <Box key={s.label} sx={{ p: 1.5, borderRadius: 1, bgcolor: '#FAFAFA' }}>
            <Caption sx={{ display: 'block', mb: 0.5 }}>{s.label}</Caption>
            {s.value}
          </Box>
        ))}
      </Box>

      <SectionHeading sx={{ mt: 4, mb: 2 }}>Recent migrations</SectionHeading>
      {t.recent_migrations.length === 0 ? (
        <Secondary>No migrations yet.</Secondary>
      ) : (
        <DataTable
          columns={[
            { key: 'kind',    header: 'Kind',    render: (m) => <Body>{m.kind}</Body> },
            { key: 'status',  header: 'Status',  render: (m) => <StatusChip status={m.status} /> },
            { key: 'when',    header: 'Created', render: (m) => <Body>{fmtDateTime(m.created_at)}</Body> },
            { key: 'err',     header: 'Error',   render: (m) => <Secondary>{m.error_message ?? '—'}</Secondary> },
          ]}
          rows={t.recent_migrations}
          rowKey={(m) => m.id}
        />
      )}
    </Box>
  );
}

// ─── shared hook ──────────────────────────────────────────────────────────
function useRemoteList<T>(fetcher: () => Promise<{ data?: T | null }>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fetcher()
      .then((r) => { if (on) { setData((r.data ?? null) as T | null); setError(null); } })
      .catch((e: unknown) => { if (on) setError(e instanceof Error ? e.message : 'Load failed'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading, error };
}

// ─── Users ────────────────────────────────────────────────────────────────
function UsersTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ users: AdminTenantUser[]; is_v2?: boolean }>(
    () => AdminService.listUsers(id),
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (data?.is_v2) return <V2HintBanner tab="users" />;
  const rows = data?.users ?? [];
  const columns: DataTableColumn<AdminTenantUser>[] = [
    {
      key: 'who',
      header: 'User',
      render: (u) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar src={u.avatar_url ?? undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: TOKENS.brandBg, color: TOKENS.brandHover }}>
            {initialsOf(u.first_name, u.last_name, u.email)}
          </Avatar>
          <Box>
            <Body sx={{ fontWeight: 600 }}>
              {(u.first_name || u.last_name) ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.email}
            </Body>
            <Caption sx={{ display: 'block' }}>{u.email}</Caption>
          </Box>
        </Stack>
      ),
    },
    { key: 'roles',    header: 'Roles',    render: (u) => <Body>{u.roles.join(', ') || '—'}</Body> },
    { key: 'verified', header: 'Verified', render: (u) => <StatusChip status={u.verified ? 'active' : 'pending'} /> },
    { key: 'joined',   header: 'Joined',   render: (u) => <Body>{fmtDate(u.created_at)}</Body> },
  ];
  return (
    <DataTable
      columns={columns} rows={rows} rowKey={(u) => u.id} loading={loading}
      emptyState={<Secondary>No users in this tenant.</Secondary>}
    />
  );
}

// ─── Sessions ─────────────────────────────────────────────────────────────
function SessionsTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ sessions: AdminTenantSession[]; is_v2?: boolean }>(
    () => AdminService.listSessions(id),
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (data?.is_v2) return <V2HintBanner tab="interview sessions" />;
  const rows = data?.sessions ?? [];
  const columns: DataTableColumn<AdminTenantSession>[] = [
    {
      key: 'title',
      header: 'Session',
      render: (s) => (
        <Box>
          <Body sx={{ fontWeight: 600 }}>{s.title}</Body>
          <Caption sx={{ display: 'block', mt: 0.25 }}>{s.interview_type}</Caption>
        </Box>
      ),
    },
    { key: 'status', header: 'Status', render: (s) => <StatusChip status={s.status.toLowerCase()} /> },
    {
      key: 'parts',
      header: 'Participants',
      render: (s) => (
        <Stack spacing={0.25}>
          {s.participants.map((p) => (
            <Caption key={p.id}>
              {p.candidate ? `🙋 ${p.candidate.email}` : null}
              {p.interviewer ? ` 🧑‍💼 ${p.interviewer.email}` : null}
            </Caption>
          ))}
          {s.participants.length === 0 && <Caption>—</Caption>}
        </Stack>
      ),
    },
    { key: 'sched',  header: 'Scheduled', render: (s) => <Body>{fmtDateTime(s.scheduled_start_at)}</Body> },
    { key: 'ended',  header: 'Ended',     render: (s) => <Body>{fmtDateTime(s.ended_at)}</Body> },
  ];
  return (
    <DataTable
      columns={columns} rows={rows} rowKey={(s) => s.id} loading={loading}
      emptyState={<Secondary>No interview sessions for this tenant.</Secondary>}
    />
  );
}

// ─── API tokens ───────────────────────────────────────────────────────────
function TokensTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ tokens: AdminTenantApiToken[]; is_v2?: boolean }>(
    () => AdminService.listApiTokens(id),
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (data?.is_v2) return <V2HintBanner tab="API tokens" />;
  const rows = data?.tokens ?? [];
  const columns: DataTableColumn<AdminTenantApiToken>[] = [
    {
      key: 'label',
      header: 'Token',
      render: (k) => (
        <Box>
          <Body sx={{ fontWeight: 600 }}>{k.label}</Body>
          <Caption sx={{ display: 'block', fontFamily: 'monospace' }}>{k.token_prefix}…</Caption>
        </Box>
      ),
    },
    { key: 'env',     header: 'Env',         render: (k) => <Body>{k.environment}</Body> },
    { key: 'lastuse', header: 'Last used',   render: (k) => <Body>{fmtDateTime(k.last_used_at)}</Body> },
    { key: 'exp',     header: 'Expires',     render: (k) => <Body>{fmtDate(k.expires_at)}</Body> },
    { key: 'created', header: 'Created',     render: (k) => <Body>{fmtDate(k.created_at)}</Body> },
  ];
  return (
    <DataTable
      columns={columns} rows={rows} rowKey={(k) => k.id} loading={loading}
      emptyState={<Secondary>No API tokens.</Secondary>}
    />
  );
}

// ─── Webhooks ─────────────────────────────────────────────────────────────
function WebhooksTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{
    endpoints: AdminTenantWebhookEndpoint[];
    deliveries: AdminTenantWebhookDelivery[];
    is_v2?: boolean;
  }>(() => AdminService.listWebhooks(id));
  if (error) return <Alert severity="error">{error}</Alert>;
  if (data?.is_v2) return <V2HintBanner tab="webhooks" />;

  return (
    <Box>
      <CardTitle sx={{ mb: 1 }}>Endpoints</CardTitle>
      <DataTable
        loading={loading}
        columns={[
          { key: 'label',  header: 'Endpoint',    render: (e) => (
            <Box>
              <Body sx={{ fontWeight: 600 }}>{e.label}</Body>
              <Caption sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all' }}>{e.url}</Caption>
            </Box>
          ) },
          { key: 'events', header: 'Events',        render: (e) => <Caption>{e.event_types.join(', ')}</Caption> },
          { key: 'status', header: 'Status',        render: (e) => <StatusChip status={e.status} /> },
          { key: 'cf',     header: 'Failures',      render: (e) => <Body>{e.consecutive_failures}</Body> },
          { key: 'last',   header: 'Last delivery', render: (e) => <Body>{fmtDateTime(e.last_delivery_at)}</Body> },
        ]}
        rows={data?.endpoints ?? []}
        rowKey={(e) => e.id}
        emptyState={<Secondary>No endpoints.</Secondary>}
      />

      <CardTitle sx={{ mt: 4, mb: 1 }}>Recent deliveries</CardTitle>
      <DataTable
        loading={loading}
        columns={[
          { key: 'event',  header: 'Event',    render: (d) => <Body sx={{ fontWeight: 600 }}>{d.event_type}</Body> },
          { key: 'status', header: 'Status',   render: (d) => <StatusChip status={d.status} /> },
          { key: 'http',   header: 'HTTP',     render: (d) => <Body>{d.http_status ?? '—'}</Body> },
          { key: 'tries',  header: 'Attempts', render: (d) => <Body>{d.attempt_count}</Body> },
          { key: 'dur',    header: 'Duration', render: (d) => <Body>{d.duration_ms ? `${d.duration_ms} ms` : '—'}</Body> },
          { key: 'when',   header: 'Created',  render: (d) => <Body>{fmtDateTime(d.created_at)}</Body> },
        ]}
        rows={data?.deliveries ?? []}
        rowKey={(d) => d.id}
        emptyState={<Secondary>No deliveries yet.</Secondary>}
      />
    </Box>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────
function InvoicesTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ invoices: AdminTenantInvoice[] }>(
    () => AdminService.listInvoices(id),
  );
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paidVia, setPaidVia] = useState('check');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [markPaidBusy, setMarkPaidBusy] = useState(false);

  if (error) return <Alert severity="error">{error}</Alert>;
  const rows = data?.invoices ?? [];

  const submit = async () => {
    if (!markPaidId) return;
    setMarkPaidBusy(true);
    try {
      await AdminService.markPaid(markPaidId, {
        paid_via: paidVia.trim() || 'check',
        payment_reference: paymentRef.trim() || undefined,
        payment_notes: notes.trim() || undefined,
      });
      setMarkPaidId(null); setPaymentRef(''); setNotes('');
    } finally {
      setMarkPaidBusy(false);
    }
  };

  const columns: DataTableColumn<AdminTenantInvoice>[] = [
    { key: 'period', header: 'Period',  render: (i) => <Body sx={{ fontWeight: 600 }}>{i.period}</Body> },
    { key: 'total',  header: 'Total',   render: (i) => <Body>${Number(i.total_usd).toFixed(2)}</Body> },
    { key: 'status', header: 'Status',  render: (i) => <StatusChip status={i.status} /> },
    { key: 'due',    header: 'Due',     render: (i) => <Body>{fmtDate(i.due_at)}</Body> },
    { key: 'paid',   header: 'Paid at', render: (i) => <Body>{fmtDateTime(i.paid_at)}</Body> },
    { key: 'pv',     header: 'Via',     render: (i) => <Body>{i.paid_via ?? '—'}</Body> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (i) => i.status !== 'paid' ? (
        <ActionButton variant="secondary" onClick={() => setMarkPaidId(i.id)}>
          Mark paid
        </ActionButton>
      ) : null,
    },
  ];
  return (
    <Box>
      <DataTable
        columns={columns} rows={rows} rowKey={(i) => i.id} loading={loading}
        emptyState={<Secondary>No invoices yet.</Secondary>}
      />
      <Dialog
        open={!!markPaidId}
        onClose={() => !markPaidBusy && setMarkPaidId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mark invoice paid</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormField
              label="Paid via" select value={paidVia} onChange={(e) => setPaidVia(e.target.value)}
              SelectProps={{ native: true }}
              disabled={markPaidBusy}
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="wire">Wire</option>
              <option value="other">Other</option>
            </FormField>
            <FormField
              label="Payment reference (optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              disabled={markPaidBusy}
            />
            <FormField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline minRows={2}
              disabled={markPaidBusy}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => setMarkPaidId(null)}
            disabled={markPaidBusy}
          >
            Cancel
          </ActionButton>
          <ActionButton onClick={submit} loading={markPaidBusy}>
            Mark paid
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Migrations ───────────────────────────────────────────────────────────
function MigrationsTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ migrations: AdminTenantMigration[] }>(
    () => AdminService.listMigrations(id),
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  const rows = data?.migrations ?? [];
  return (
    <DataTable
      loading={loading}
      columns={[
        { key: 'kind',   header: 'Kind',     render: (m) => <Body sx={{ fontWeight: 600 }}>{m.kind}</Body> },
        { key: 'status', header: 'Status',   render: (m) => <StatusChip status={m.status} /> },
        { key: 'start',  header: 'Started',  render: (m) => <Body>{fmtDateTime(m.started_at)}</Body> },
        { key: 'end',    header: 'Finished', render: (m) => <Body>{fmtDateTime(m.finished_at)}</Body> },
        { key: 'err',    header: 'Error',    render: (m) => <Secondary>{m.error_message ?? '—'}</Secondary> },
      ]}
      rows={rows}
      rowKey={(m) => m.id}
      emptyState={<Secondary>No migrations.</Secondary>}
    />
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────
function AuditTab({ id }: { id: string }) {
  const { data, loading, error } = useRemoteList<{ actions: AdminTenantAuditAction[] }>(
    () => AdminService.listAdminActions(id),
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  const rows = data?.actions ?? [];
  return (
    <DataTable
      loading={loading}
      columns={[
        { key: 'when',   header: 'When',    render: (a) => <Body>{fmtDateTime(a.created_at)}</Body> },
        { key: 'who',    header: 'User',    render: (a) => <Caption sx={{ fontFamily: 'monospace' }}>{a.user_id.slice(0, 8)}…</Caption> },
        { key: 'action', header: 'Action',  render: (a) => <Body sx={{ fontWeight: 600 }}>{a.action}</Body> },
        { key: 'detail', header: 'Details', render: (a) => (
          <Caption sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {a.details ? JSON.stringify(a.details) : '—'}
          </Caption>
        ) },
      ]}
      rows={rows}
      rowKey={(a) => a.id}
      emptyState={<Secondary>No admin actions yet.</Secondary>}
    />
  );
}
