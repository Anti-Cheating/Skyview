import { useEffect, useMemo, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';
import ActionDialog from './ActionDialog';

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

export default function LicensingPage() {
  const { showError, showSuccess } = useSnackbar();
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [issueOpen, setIssueOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [interviews, setInterviews] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

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
    setCompanyId('');
    setInterviews('');
    setExpiresAt('');
    setIssuedToken(null);
    setIssueOpen(true);
  };

  const handleIssue = async () => {
    const count = Number(interviews);
    if (!companyId || !Number.isFinite(count)) return;
    setIssuing(true);
    try {
      const r = await AdminService.issueLicense({ company_id: companyId, interviews: count, expires_at: expiresAt });
      setIssuedToken(r.data?.license_token ?? '');
      showSuccess('License issued.');
      refresh();
    } catch (e: any) {
      showError(e?.message || 'Failed to issue license');
    } finally {
      setIssuing(false);
    }
  };

  const columns = useMemo<DataTableColumn<LicenseRow>[]>(
    () => [
      { key: 'name', header: 'Company', render: (l) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{l.name}</Box> },
      { key: 'remaining', header: 'Remaining', width: 110, align: 'right', render: (l) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{l.remaining}</Box> },
      { key: 'used', header: 'Used', width: 90, align: 'right', render: (l) => <Box sx={{ color: TOKENS.textSecondary }}>{l.used}</Box> },
      { key: 'status', header: 'Status', width: 110, render: (l) => <Box sx={{ color: TOKENS.textSecondary }}>{l.status}</Box> },
      { key: 'expires', header: 'Expires', width: 120, hideOn: 'mobile', render: (l) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(l.expires_at)}</Caption> },
      { key: 'last_seen', header: 'Last seen', width: 120, hideOn: 'mobile', render: (l) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{fmtDate(l.last_seen)}</Caption> },
      {
        key: 'actions',
        header: '',
        width: 200,
        align: 'right',
        render: (l) => (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
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
            <TextField label="Company ID" value={companyId} onChange={(e) => setCompanyId(e.target.value)} fullWidth size="small" />
            <TextField label="Interviews" type="number" value={interviews} onChange={(e) => setInterviews(e.target.value)} fullWidth size="small" />
            <TextField label="Expires at" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            {issuedToken !== null && (
              <TextField label="License token" value={issuedToken} fullWidth multiline minRows={3} InputProps={{ readOnly: true }} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="secondary" onClick={() => setIssueOpen(false)}>Close</ActionButton>
          <ActionButton onClick={handleIssue} loading={issuing} disabled={issuedToken !== null}>Issue</ActionButton>
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
    </Box>
  );
}
