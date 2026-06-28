import { useEffect, useMemo, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
  ToggleButton, ToggleButtonGroup, Autocomplete,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';
import ActionDialog from './ActionDialog';
import LicenseKeyDialog from './LicenseKeyDialog';

type LicenseAction = { kind: 'topup' | 'suspend'; company: string; name: string };

interface LicenseRow {
  company_id: string;
  name: string;
  remaining: number;
  used: number;
  minutes: number;
  status: string;
  license_id: string;
  expires_at: string | null;
  last_seen: string | null;
}

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleDateString() : '—');

/** Expiry date + a coloured warning when a license is expired or expiring soon. */
function ExpiryCell({ value }: { value: string | null }) {
  if (!value) return <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>—</Caption>;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  const expired = days < 0;
  const soon = days >= 0 && days <= 30;
  return (
    <Box>
      <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem', display: 'block' }}>{new Date(value).toLocaleDateString()}</Caption>
      {(expired || soon) && (
        <Caption sx={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', color: expired ? TOKENS.error : '#B45309' }}>
          {expired ? 'Expired' : `in ${days}d`}
        </Caption>
      )}
    </Box>
  );
}

export default function LicensingPage() {
  const { showError, showSuccess } = useSnackbar();
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [issueOpen, setIssueOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [companyName, setCompanyName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
  const [interviews, setInterviews] = useState('');
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [keyDialog, setKeyDialog] = useState<{ name: string; token: string; expiresAt: string | null } | null>(null);

  useEffect(() => {
    setLoading(true);
    AdminService.licenses()
      .then((r) => setRows(r.data?.items ?? []))
      .catch((e: any) => showError(e?.message || 'Failed to load licenses'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const [action, setAction] = useState<LicenseAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const runAction = async (value: string) => {
    if (!action) return;
    if (action.kind === 'topup') {
      const add = Number(value);
      if (!Number.isFinite(add) || add === 0) { showError('Enter a non-zero number.'); return; }
      setActionBusy(true);
      try {
        await AdminService.topupLicense(action.company, add);
        showSuccess('License topped up.');
        setAction(null);
        refresh();
      } catch (e: any) {
        showError(e?.message || 'Failed to top up license');
      } finally {
        setActionBusy(false);
      }
    } else {
      setActionBusy(true);
      try {
        await AdminService.suspendLicense(action.company);
        showSuccess('License suspended.');
        setAction(null);
        refresh();
      } catch (e: any) {
        showError(e?.message || 'Failed to suspend license');
      } finally {
        setActionBusy(false);
      }
    }
  };

  const openIssue = () => {
    setMode('new');
    setCompanyName('');
    setBillingEmail('');
    setSelectedCompany(null);
    setInterviews('');
    setExpiresAt(null);
    setIssueOpen(true);
    // Load companies for the "existing company" dropdown.
    AdminService.listCompanies({ limit: 200 })
      .then((r) => setCompanyOptions((r.data?.items ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompanyOptions([]));
  };

  const handleIssue = async () => {
    const count = Number(interviews);
    const expiresStr = expiresAt ? expiresAt.format('YYYY-MM-DD') : '';
    if (!Number.isFinite(count) || count <= 0 || !expiresStr) { showError('Enter interviews and an expiry date.'); return; }
    if (mode === 'new') {
      if (!companyName.trim()) { showError('Enter a company name.'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingEmail.trim())) { showError('Enter a valid billing email — it’s our only contact for the customer.'); return; }
    } else if (!selectedCompany) {
      showError('Select a company.');
      return;
    }
    setIssuing(true);
    try {
      let token = '';
      let name = '';
      if (mode === 'new') {
        const r = await AdminService.onboardEnterprise({ company_name: companyName.trim(), billing_email: billingEmail.trim(), interviews: count, expires_at: expiresStr });
        token = r.data?.license_token ?? '';
        name = r.data?.name ?? companyName.trim();
      } else {
        const r = await AdminService.issueLicense({ company_id: selectedCompany!.id, interviews: count, expires_at: expiresStr });
        token = r.data?.license_token ?? '';
        name = selectedCompany!.name;
      }
      setIssueOpen(false);
      showSuccess('License issued.');
      setKeyDialog({ name, token, expiresAt: expiresStr || null });
      refresh();
    } catch (e: any) {
      showError(e?.message || 'Failed to issue license');
    } finally {
      setIssuing(false);
    }
  };

  const viewKey = async (company: string, name: string) => {
    try {
      const r = await AdminService.licenseToken(company);
      setKeyDialog({ name, token: r.data?.token ?? '', expiresAt: r.data?.expires_at ?? null });
    } catch (e: any) {
      showError(e?.message || 'Failed to load key');
    }
  };

  const columns = useMemo<DataTableColumn<LicenseRow>[]>(
    () => [
      { key: 'name', header: 'Company', render: (l) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{l.name}</Box> },
      { key: 'remaining', header: 'Remaining', width: 110, align: 'right', render: (l) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{l.remaining}</Box> },
      { key: 'used', header: 'Used', width: 90, align: 'right', render: (l) => <Box sx={{ color: TOKENS.textSecondary }}>{l.used}</Box> },
      { key: 'status', header: 'Status', width: 110, render: (l) => <Box sx={{ color: TOKENS.textSecondary }}>{l.status}</Box> },
      { key: 'expires', header: 'Expires', width: 120, hideOn: 'mobile', render: (l) => <ExpiryCell value={l.expires_at} /> },
      { key: 'last_seen', header: 'Last seen', width: 120, hideOn: 'mobile', render: (l) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(l.last_seen)}</Caption> },
      {
        key: 'actions',
        header: '',
        width: 280,
        align: 'right',
        render: (l) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <ActionButton variant="secondary" size="small" onClick={() => viewKey(l.company_id, l.name)}>View key</ActionButton>
            <ActionButton variant="secondary" size="small" onClick={() => setAction({ kind: 'topup', company: l.company_id, name: l.name })}>Top-up</ActionButton>
            <ActionButton variant="secondary" size="small" onClick={() => setAction({ kind: 'suspend', company: l.company_id, name: l.name })}>Suspend</ActionButton>
          </Stack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Licensing</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>Self-hosted license tokens and quotas.</Secondary>
        </Box>
        <ActionButton startIcon={<AddIcon />} onClick={openIssue}>Issue license</ActionButton>
      </Box>

      <DataTable<LicenseRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.license_id || r.company_id}
        loading={loading}
        emptyText="No licenses issued."
      />

      <Dialog open={issueOpen} onClose={() => setIssueOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Issue license</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ToggleButtonGroup
              value={mode}
              exclusive
              size="small"
              fullWidth
              onChange={(_, v) => { if (v) setMode(v); }}
            >
              <ToggleButton value="new">New company</ToggleButton>
              <ToggleButton value="existing">Existing company</ToggleButton>
            </ToggleButtonGroup>

            {mode === 'new' ? (
              <>
                <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth size="small" autoFocus />
                <TextField label="Billing email" type="email" required value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} fullWidth size="small" helperText="Our only contact for this self-hosted customer — used for the key, renewals and invoices." />
              </>
            ) : (
              <Autocomplete
                options={companyOptions}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={selectedCompany}
                onChange={(_, v) => setSelectedCompany(v)}
                fullWidth
                size="small"
                renderInput={(params) => <TextField {...params} label="Company" autoFocus />}
              />
            )}
            <TextField label="Interviews" type="number" value={interviews} onChange={(e) => setInterviews(e.target.value)} fullWidth size="small" />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Expires at"
                value={expiresAt}
                onChange={(v) => setExpiresAt(v)}
                disablePast
                minDate={dayjs().add(1, 'day')}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </LocalizationProvider>
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="secondary" onClick={() => setIssueOpen(false)}>Cancel</ActionButton>
          <ActionButton onClick={handleIssue} loading={issuing}>Issue</ActionButton>
        </DialogActions>
      </Dialog>

      <ActionDialog
        open={!!action}
        title={action?.kind === 'topup' ? `Top up — ${action?.name ?? ''}` : `Suspend license — ${action?.name ?? ''}`}
        message={action?.kind === 'suspend' ? 'This suspends the license so the customer can no longer consume interviews. Continue?' : undefined}
        input={action?.kind === 'topup' ? { label: 'Interviews to add', type: 'number', placeholder: 'e.g. 500' } : undefined}
        confirmLabel={action?.kind === 'topup' ? 'Top up' : 'Suspend'}
        destructive={action?.kind === 'suspend'}
        busy={actionBusy}
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />

      <LicenseKeyDialog
        open={!!keyDialog}
        companyName={keyDialog?.name ?? ''}
        token={keyDialog?.token ?? ''}
        expiresAt={keyDialog?.expiresAt ?? null}
        onClose={() => setKeyDialog(null)}
      />
    </Box>
  );
}
