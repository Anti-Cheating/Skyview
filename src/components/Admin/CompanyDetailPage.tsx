import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Chip, Tabs, Tab, Alert, CircularProgress, Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  People as PeopleIcon,
  Videocam as VideocamIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, CardTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';
import ActionDialog from './ActionDialog';

interface CompanyInfo {
  id: string; name: string; slug: string; status: string; created_at: string;
  website: string | null; location: string | null; billing_contact_email: string | null;
}
interface Counts { users: number; interview_sessions: number; interview_processes: number; }
interface Subscription {
  status: string; interviews_remaining: number; interviews_used: number;
  total_minutes_used: number; license_expires_at: string | null;
}
interface Plan { key: string; name: string; tier: string; interviews_per_cycle: number; max_seats: number; }
interface Overview {
  company: CompanyInfo; counts: Counts; is_self_hosted: boolean;
  subscription: Subscription | null; plan: Plan | null;
}
interface UserRow {
  id: string; email: string; name: string | null; status: string;
  verified: boolean; created_at: string; roles: string[];
}
interface PaymentRow { id: string; amount: number; currency: string; status: string; paid_at: string | null; created_at: string; }
interface InvoiceRow { id: string; period: string; total_usd: number; status: string; created_at: string; }
interface BillingData {
  subscription: Subscription | null; payments: PaymentRow[]; invoices: InvoiceRow[]; billing_history: unknown[];
}
interface InterviewRow {
  id: string; title: string; status: string; round_name: string | null;
  analysis_status: string | null; scheduled_start_at: string | null; ended_at: string | null; duration_minutes: number | null;
}
interface InterviewsData { self_hosted: boolean; items: InterviewRow[] }
interface WebhookEndpoint {
  id: string; label: string; url: string; event_types: string[]; status: string;
  consecutive_failures: number; created_at: string;
}
interface WebhookDelivery { id: string; event_type: string; status: string; http_status: number | null; attempt_count: number; created_at: string; }
interface WebhooksData { endpoints: WebhookEndpoint[]; deliveries: WebhookDelivery[]; }
interface SecurityData { active_sessions: number; pending_resets: number; pending_verifications: number; }

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleDateString() : '—');
const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function StatCard({ label, value, icon, bgColor }: { label: string; value: ReactNode; icon: ReactNode; bgColor: string }) {
  return (
    <Card elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 }, borderRadius: '12px', bgcolor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
        </Box>
        <Typography component="p" sx={{ color: TOKENS.textPrimary, mb: 0.5, fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: TOKENS.textSecondary, fontWeight: 500 }}>{label}</Typography>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75, borderBottom: `1px solid ${TOKENS.borderLight}` }}>
      <Secondary sx={{ color: TOKENS.textSecondary }}>{label}</Secondary>
      <Secondary sx={{ color: TOKENS.textPrimary, textAlign: 'right', fontWeight: 500 }}>{value ?? '—'}</Secondary>
    </Box>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <CardTitle sx={{ color: TOKENS.textPrimary, mb: 2 }}>{title}</CardTitle>
        {children}
      </CardContent>
    </Card>
  );
}

export default function CompanyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [interviews, setInterviews] = useState<InterviewsData | null>(null);
  const [webhooks, setWebhooks] = useState<WebhooksData | null>(null);
  const [security, setSecurity] = useState<SecurityData | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      AdminService.getCompany(id),
      AdminService.companyUsers(id),
      AdminService.companyBilling(id),
      AdminService.companyInterviews(id),
      AdminService.companyWebhooks(id),
      AdminService.companySecurity(id),
    ])
      .then(([ov, us, bi, iv, wh, se]) => {
        if (!active) return;
        setOverview((ov.data as Overview) ?? null);
        setUsers(us.data?.users ?? []);
        setBilling((bi.data as BillingData) ?? null);
        setInterviews((iv.data as InterviewsData) ?? null);
        setWebhooks((wh.data as WebhooksData) ?? null);
        setSecurity((se.data as SecurityData) ?? null);
      })
      .catch((e: any) => showError(e?.message || 'Failed to load company'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const [action, setAction] = useState<'quota' | 'suspend' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const runAction = async (value: string) => {
    if (action === 'quota') {
      const add = Number(value);
      if (!Number.isFinite(add) || add === 0) { showError('Enter a non-zero number.'); return; }
      setActionBusy(true);
      try {
        await AdminService.adjustQuota(id, add);
        showSuccess('Quota adjusted.');
        setAction(null);
        refresh();
      } catch (e: any) {
        showError(e?.message || 'Failed to adjust quota');
      } finally {
        setActionBusy(false);
      }
    } else if (action === 'suspend') {
      setActionBusy(true);
      try {
        await AdminService.suspendCompany(id);
        showSuccess('Company suspended.');
        setAction(null);
        refresh();
      } catch (e: any) {
        showError(e?.message || 'Failed to suspend company');
      } finally {
        setActionBusy(false);
      }
    }
  };

  const userColumns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      { key: 'email', header: 'Email', render: (u) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{u.email}</Box> },
      { key: 'name', header: 'Name', render: (u) => <Box sx={{ color: TOKENS.textSecondary }}>{u.name ?? '—'}</Box> },
      { key: 'status', header: 'Status', width: 110, render: (u) => <Box sx={{ color: TOKENS.textSecondary }}>{u.status}</Box> },
      { key: 'roles', header: 'Roles', hideOn: 'mobile', render: (u) => <Box sx={{ color: TOKENS.textSecondary }}>{(u.roles ?? []).join(', ') || '—'}</Box> },
      { key: 'verified', header: 'Verified', width: 100, render: (u) => <Box sx={{ color: TOKENS.textSecondary }}>{u.verified ? 'Yes' : 'No'}</Box> },
      { key: 'created', header: 'Created', width: 120, hideOn: 'mobile', render: (u) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(u.created_at)}</Caption> },
    ],
    []
  );

  const paymentColumns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      { key: 'amount', header: 'Amount', width: 130, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{rupees(p.amount)}</Box> },
      { key: 'currency', header: 'Currency', width: 100, hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.currency}</Box> },
      { key: 'status', header: 'Status', width: 120, render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.status}</Box> },
      { key: 'paid', header: 'Paid', width: 130, render: (p) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(p.paid_at)}</Caption> },
      { key: 'created', header: 'Created', width: 130, hideOn: 'mobile', render: (p) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(p.created_at)}</Caption> },
    ],
    []
  );

  const interviewColumns = useMemo<DataTableColumn<InterviewRow>[]>(
    () => [
      { key: 'title', header: 'Title', render: (it) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{it.title}</Box> },
      { key: 'round', header: 'Round', hideOn: 'mobile', render: (it) => <Box sx={{ color: TOKENS.textSecondary }}>{it.round_name ?? '—'}</Box> },
      { key: 'status', header: 'Status', width: 120, render: (it) => <Box sx={{ color: TOKENS.textSecondary }}>{it.status}</Box> },
      { key: 'analysis', header: 'Analysis', width: 120, hideOn: 'mobile', render: (it) => <Box sx={{ color: TOKENS.textSecondary }}>{it.analysis_status ?? '—'}</Box> },
      { key: 'scheduled', header: 'Scheduled', width: 130, hideOn: 'mobile', render: (it) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(it.scheduled_start_at)}</Caption> },
      { key: 'minutes', header: 'Minutes', width: 90, align: 'right', render: (it) => <Box sx={{ color: TOKENS.textSecondary }}>{it.duration_minutes ?? '—'}</Box> },
    ],
    []
  );

  const endpointColumns = useMemo<DataTableColumn<WebhookEndpoint>[]>(
    () => [
      { key: 'label', header: 'Label', render: (ep) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{ep.label}</Box> },
      { key: 'url', header: 'URL', render: (ep) => <Box sx={{ maxWidth: 260, color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.url}</Box> },
      { key: 'events', header: 'Events', hideOn: 'mobile', render: (ep) => <Box sx={{ color: TOKENS.textSecondary }}>{(ep.event_types ?? []).join(', ')}</Box> },
      { key: 'status', header: 'Status', width: 110, render: (ep) => <Box sx={{ color: TOKENS.textSecondary }}>{ep.status}</Box> },
      { key: 'failures', header: 'Failures', width: 100, align: 'right', render: (ep) => <Box sx={{ color: TOKENS.textSecondary }}>{ep.consecutive_failures}</Box> },
    ],
    []
  );

  const deliveryColumns = useMemo<DataTableColumn<WebhookDelivery>[]>(
    () => [
      { key: 'event', header: 'Event', render: (d) => <Box sx={{ color: TOKENS.textPrimary }}>{d.event_type}</Box> },
      { key: 'status', header: 'Status', width: 120, render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.status}</Box> },
      { key: 'http', header: 'HTTP', width: 80, align: 'right', render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.http_status ?? '—'}</Box> },
      { key: 'attempts', header: 'Attempts', width: 100, align: 'right', hideOn: 'mobile', render: (d) => <Box sx={{ color: TOKENS.textSecondary }}>{d.attempt_count}</Box> },
      { key: 'created', header: 'When', width: 130, hideOn: 'mobile', render: (d) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(d.created_at)}</Caption> },
    ],
    []
  );

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const c = overview?.company;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        component="button"
        onClick={() => navigate('/admin/companies')}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1.5,
          background: 'none', border: 'none', p: 0, cursor: 'pointer',
          color: TOKENS.textSecondary, '&:hover': { color: TOKENS.brand },
        }}
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        <Caption sx={{ fontSize: '0.8125rem' }}>Back to companies</Caption>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PageTitle sx={{ color: TOKENS.textPrimary }}>{c?.name ?? 'Company'}</PageTitle>
          {overview?.is_self_hosted ? (
            <Chip label="Self-hosted" size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: TOKENS.brandBg, color: '#047857' }} />
          ) : (
            <Chip label="Cloud" size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, borderColor: TOKENS.border, color: TOKENS.textSecondary }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ActionButton variant="secondary" onClick={() => setAction('quota')}>Adjust quota</ActionButton>
          <ActionButton variant="secondary" onClick={() => setAction('suspend')}>Suspend</ActionButton>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${TOKENS.border}` }} variant="scrollable" scrollButtons="auto">
        <Tab label="Overview" />
        <Tab label="Users" />
        <Tab label="Billing" />
        <Tab label="Interviews" />
        <Tab label="Webhooks" />
        <Tab label="Security" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
            <StatCard label="Users" value={overview?.counts.users ?? 0} icon={<PeopleIcon sx={{ fontSize: 24, color: TOKENS.brand }} />} bgColor="rgba(76, 217, 100, 0.15)" />
            <StatCard label="Interview sessions" value={overview?.counts.interview_sessions ?? 0} icon={<VideocamIcon sx={{ fontSize: 24, color: '#3B82F6' }} />} bgColor="rgba(59, 130, 246, 0.12)" />
            <StatCard label="Interview processes" value={overview?.counts.interview_processes ?? 0} icon={<AccountTreeIcon sx={{ fontSize: 24, color: '#6B7280' }} />} bgColor="rgba(107, 114, 128, 0.12)" />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            <InfoCard title="Company">
              <Field label="Slug" value={c?.slug} />
              <Field label="Status" value={c?.status} />
              <Field label="Website" value={c?.website} />
              <Field label="Location" value={c?.location} />
              <Field label="Billing email" value={c?.billing_contact_email} />
              <Field label="Created" value={fmtDate(c?.created_at)} />
            </InfoCard>
            <InfoCard title="Subscription">
              {overview?.subscription ? (
                <>
                  <Field label="Status" value={overview.subscription.status} />
                  <Field label="Remaining" value={overview.subscription.interviews_remaining} />
                  <Field label="Used" value={overview.subscription.interviews_used} />
                  <Field label="Minutes used" value={overview.subscription.total_minutes_used} />
                  <Field label="License expires" value={fmtDate(overview.subscription.license_expires_at)} />
                </>
              ) : <Secondary sx={{ color: TOKENS.textMuted }}>No subscription</Secondary>}
            </InfoCard>
            <InfoCard title="Plan">
              {overview?.plan ? (
                <>
                  <Field label="Name" value={overview.plan.name} />
                  <Field label="Key" value={overview.plan.key} />
                  <Field label="Tier" value={overview.plan.tier} />
                  <Field label="Interviews / cycle" value={overview.plan.interviews_per_cycle} />
                  <Field label="Max seats" value={overview.plan.max_seats} />
                </>
              ) : <Secondary sx={{ color: TOKENS.textMuted }}>No plan</Secondary>}
            </InfoCard>
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <DataTable<UserRow> columns={userColumns} rows={users} rowKey={(r) => r.id} emptyText="No users." />
      )}

      {tab === 2 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <InfoCard title="Subscription">
            {billing?.subscription ? (
              <>
                <Field label="Status" value={billing.subscription.status} />
                <Field label="Remaining" value={billing.subscription.interviews_remaining} />
                <Field label="Used" value={billing.subscription.interviews_used} />
                <Field label="Minutes used" value={billing.subscription.total_minutes_used} />
                <Field label="License expires" value={fmtDate(billing.subscription.license_expires_at)} />
              </>
            ) : <Secondary sx={{ color: TOKENS.textMuted }}>No subscription</Secondary>}
          </InfoCard>
          <DataTable<PaymentRow> columns={paymentColumns} rows={billing?.payments ?? []} rowKey={(r) => r.id} emptyText="No payments." />
        </Box>
      )}

      {tab === 3 && (
        interviews?.self_hosted ? (
          <Alert severity="info">Interview data resides in the customer's cluster.</Alert>
        ) : (
          <DataTable<InterviewRow> columns={interviewColumns} rows={interviews?.items ?? []} rowKey={(r) => r.id} emptyText="No interviews." />
        )
      )}

      {tab === 4 && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box>
            <CardTitle sx={{ color: TOKENS.textPrimary, mb: 1.5 }}>Endpoints</CardTitle>
            <DataTable<WebhookEndpoint> columns={endpointColumns} rows={webhooks?.endpoints ?? []} rowKey={(r) => r.id} emptyText="No endpoints." />
          </Box>
          <Box>
            <CardTitle sx={{ color: TOKENS.textPrimary, mb: 1.5 }}>Deliveries</CardTitle>
            <DataTable<WebhookDelivery> columns={deliveryColumns} rows={webhooks?.deliveries ?? []} rowKey={(r) => r.id} emptyText="No deliveries." />
          </Box>
        </Box>
      )}

      {tab === 5 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3 }}>
          <StatCard label="Active sessions" value={security?.active_sessions ?? 0} icon={<PeopleIcon sx={{ fontSize: 24, color: TOKENS.brand }} />} bgColor="rgba(76, 217, 100, 0.15)" />
          <StatCard label="Pending resets" value={security?.pending_resets ?? 0} icon={<AccountTreeIcon sx={{ fontSize: 24, color: '#3B82F6' }} />} bgColor="rgba(59, 130, 246, 0.12)" />
          <StatCard label="Pending verifications" value={security?.pending_verifications ?? 0} icon={<VideocamIcon sx={{ fontSize: 24, color: '#6B7280' }} />} bgColor="rgba(107, 114, 128, 0.12)" />
        </Box>
      )}

      <ActionDialog
        open={!!action}
        title={action === 'quota' ? 'Adjust quota' : 'Suspend company'}
        message={action === 'suspend' ? 'This halts the company’s subscription so they can no longer start interviews. Continue?' : undefined}
        input={action === 'quota' ? { label: 'Interviews to add (negative to remove)', type: 'number', placeholder: 'e.g. 50' } : undefined}
        confirmLabel={action === 'quota' ? 'Adjust' : 'Suspend'}
        destructive={action === 'suspend'}
        busy={actionBusy}
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
    </Box>
  );
}
