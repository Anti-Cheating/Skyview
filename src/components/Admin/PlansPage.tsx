import { useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Stack,
} from '@mui/material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { AdminService } from '../../services/admin.service';

interface PlanRow {
  id: string;
  plan_key: string;
  name: string;
  tier: string;
  interval: string;
  amount: number;
  currency: string;
  interviews_per_cycle: number;
  minutes_per_interview: number;
  max_seats: number;
  is_active: boolean;
}

const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PlansPage() {
  const { showError, showSuccess } = useSnackbar();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [interviewsPerCycle, setInterviewsPerCycle] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    AdminService.plans()
      .then((r) => setRows(r.data?.items ?? []))
      .catch((e: any) => showError(e?.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const openEdit = (p: PlanRow) => {
    setEditing(p);
    setInterviewsPerCycle(String(p.interviews_per_cycle));
    setIsActive(p.is_active);
  };

  const handleSave = async () => {
    if (!editing) return;
    const count = Number(interviewsPerCycle);
    if (!Number.isFinite(count)) return;
    setSaving(true);
    try {
      await AdminService.updatePlan(editing.id, { interviews_per_cycle: count, is_active: isActive });
      showSuccess('Plan updated.');
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      showError(e?.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<DataTableColumn<PlanRow>[]>(
    () => [
      { key: 'key', header: 'Key', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.plan_key}</Box> },
      { key: 'name', header: 'Name', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{p.name}</Box> },
      { key: 'tier', header: 'Tier', width: 100, hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.tier}</Box> },
      { key: 'ipc', header: 'Interviews / cycle', width: 140, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{p.interviews_per_cycle}</Box> },
      { key: 'mpi', header: 'Minutes', width: 100, align: 'right', hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.minutes_per_interview}</Box> },
      { key: 'seats', header: 'Max seats', width: 110, align: 'right', hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.max_seats}</Box> },
      { key: 'amount', header: 'Amount', width: 120, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{rupees(p.amount)}</Box> },
      {
        key: 'active',
        header: 'Active',
        width: 110,
        render: (p) =>
          p.is_active ? (
            <Chip label="Active" size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(76,217,100,0.14)', color: '#047857' }} />
          ) : (
            <Chip label="Inactive" size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, borderColor: TOKENS.border, color: TOKENS.textSecondary }} />
          ),
      },
      {
        key: 'actions',
        header: '',
        width: 90,
        align: 'right',
        render: (p) => (
          <ActionButton variant="secondary" size="small" onClick={() => openEdit(p)}>Edit</ActionButton>
        ),
      },
    ],
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Plans</PageTitle>
        <Secondary sx={{ color: TOKENS.textSecondary }}>Subscription plan catalogue.</Secondary>
      </Box>

      <DataTable<PlanRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No plans configured."
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit plan{editing ? ` — ${editing.name}` : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Interviews / cycle" type="number" fullWidth size="small" value={interviewsPerCycle} onChange={(e) => setInterviewsPerCycle(e.target.value)} />
            <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Active" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton variant="secondary" onClick={() => setEditing(null)}>Cancel</ActionButton>
          <ActionButton onClick={handleSave} loading={saving}>Save</ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
