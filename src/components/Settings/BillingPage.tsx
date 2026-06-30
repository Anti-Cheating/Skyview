/**
 * BillingPage — /settings/billing
 *
 * Lives inside SettingsLayout, which already renders <PageTitle>Settings</PageTitle>
 * plus horizontal tabs. So this page starts at <SectionHeading>Billing</SectionHeading>
 * — no inner PageTitle.
 *
 * Sections:
 *   1. Usage         — current sessions vs plan limit + thin progress bar
 *   2. Plan          — stat grid (Plan, Plan limit, Cap policy, Overage)
 *   3. Billing contact — single FormField + ActionButton
 *   4. Invoices      — <DataTable> with status pill
 */

import { useEffect, useState } from 'react';
import { Box, Stack, Alert } from '@mui/material';
import {
  SectionHeading, CardTitle, Body, Secondary, Caption,
} from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { TOKENS } from '../../theme';
import { BillingService, type UsageInfo, type BillingInvoice as Invoice } from '../../services/billing.service';

const PAGE_SIZE = 20;

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString();
}
function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// Soft pill matching the design-system status color matrix.
function InvoiceStatusPill({ status }: { status: string }) {
  const c =
    status === 'paid'    ? { bg: 'rgba(34,197,94,0.12)',  fg: '#15803D' } :
    status === 'overdue' ? { bg: 'rgba(239,68,68,0.12)',  fg: '#B91C1C' } :
    status === 'draft'   ? { bg: 'rgba(234,179,8,0.12)',  fg: '#A16207' } :
                           { bg: '#F3F4F6',               fg: '#4B5563' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
        borderRadius: '6px', bgcolor: c.bg, color: c.fg,
        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  );
}

// Thin 4px progress bar — mirrors the UsageBar pattern from TenantList.
function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0);
  const over = used > limit;
  return (
    <Box sx={{
      height: 4, borderRadius: 999, bgcolor: '#F3F4F6', overflow: 'hidden',
    }}>
      <Box sx={{
        height: '100%',
        width: `${pct}%`,
        bgcolor: over ? '#EF4444' : TOKENS.brand,
      }} />
    </Box>
  );
}

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    BillingService.usage().then((r) => {
      if (r.data) {
        setUsage(r.data);
        setContact(r.data.billing_contact_email ?? '');
      }
    });
    BillingService.invoices().then((r) => setInvoices(r.data?.invoices ?? []));
  }, []);

  const saveContact = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await BillingService.updateBillingContact(contact.trim() || null);
      setFeedback({ kind: 'success', message: 'Billing contact updated.' });
    } catch (e: unknown) {
      setFeedback({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Could not update billing contact.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!usage) return <Secondary>Loading…</Secondary>;

  const stats: { label: string; value: React.ReactNode }[] = [
    { label: 'Plan',                value: <Body sx={{ textTransform: 'capitalize' }}>{usage.plan}</Body> },
    { label: 'Plan limit',          value: <Body>{usage.plan_limit} sessions / month</Body> },
    { label: 'Cap policy',          value: <Body sx={{ textTransform: 'capitalize' }}>{usage.cap_policy}</Body> },
    { label: 'Overage per session', value: <Body>${Number(usage.overage_per_session_usd).toFixed(2)}</Body> },
  ];

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'period', header: 'Period',   render: (i) => <Body>{i.period}</Body> },
    { key: 'total',  header: 'Total',    render: (i) => <Body>${Number(i.total_usd).toFixed(2)}</Body> },
    { key: 'status', header: 'Status',   render: (i) => <InvoiceStatusPill status={i.status} /> },
    { key: 'due',    header: 'Due',      render: (i) => <Body>{fmtDate(i.due_at)}</Body> },
    { key: 'paid',   header: 'Paid at',  render: (i) => <Body>{fmtDateTime(i.paid_at)}</Body> },
    { key: 'via',    header: 'Paid via', render: (i) => <Body>{i.paid_via ?? '—'}</Body> },
  ];

  const pagedInvoices = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <SectionHeading>Billing</SectionHeading>
        <Secondary>Track usage, manage your billing contact, and review past invoices.</Secondary>
      </Box>

      <Stack spacing={3}>
        {/* Usage */}
        <Box>
          <CardTitle sx={{ mb: 1.5 }}>Usage</CardTitle>
          <Body sx={{ mb: 1 }}>
            {usage.current} of {usage.plan_limit} sessions this month
          </Body>
          <UsageBar used={usage.current} limit={usage.plan_limit} />
          <Caption sx={{ display: 'block', mt: 1, textTransform: 'capitalize' }}>
            {usage.cap_policy} cap
          </Caption>
        </Box>

        {/* Plan */}
        <Box>
          <CardTitle sx={{ mb: 1.5 }}>Plan</CardTitle>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}>
            {stats.map((s) => (
              <Box key={s.label} sx={{ p: 1.5, borderRadius: 1, bgcolor: '#FAFAFA' }}>
                <Caption sx={{ display: 'block', mb: 0.5 }}>{s.label}</Caption>
                {s.value}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Billing contact */}
        <Box>
          <CardTitle sx={{ mb: 1.5 }}>Billing contact</CardTitle>
          <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
            <FormField
              label="Billing email"
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="ap@yourcompany.com"
            />
            <Box>
              <ActionButton onClick={saveContact} loading={saving}>Save</ActionButton>
            </Box>
            {feedback && (
              <Alert severity={feedback.kind} onClose={() => setFeedback(null)}>
                {feedback.message}
              </Alert>
            )}
          </Stack>
        </Box>

        {/* Invoices */}
        <Box>
          <CardTitle sx={{ mb: 1.5 }}>Invoices</CardTitle>
          <DataTable
            columns={columns}
            rows={pagedInvoices}
            rowKey={(i) => i.id}
            emptyState={<Secondary>No invoices yet.</Secondary>}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: invoices.length,
              showSizeChanger: false,
              onChange: setPage,
            }}
          />
        </Box>
      </Stack>
    </Box>
  );
}
