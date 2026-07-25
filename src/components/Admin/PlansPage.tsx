import { useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Stack, Alert, IconButton, InputAdornment, Typography,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
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
  interval: string | null;
  amount: number | null;
  currency: string;
  interviews_per_cycle: number;
  minutes_per_interview: number;
  max_seats: number | null;
  is_active: boolean;
  features: string[] | null;
  /** Edit-safety guardrail: how many companies sit on this plan right now. */
  companies_subscribed: number;
}

const rupees = (paise: number | null): string =>
  paise == null ? '—' : `₹${(paise / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Shared editable form shape (all numeric fields kept as strings for inputs). */
interface FormState {
  plan_key: string;
  name: string;
  amount: string;            // rupees in the UI, paise on the wire
  interval: string;          // 'monthly' | 'yearly' | ''
  interviews_per_cycle: string;
  minutes_per_interview: string;
  max_seats: string;         // '' = unlimited
  features: string[];
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  plan_key: '', name: '', amount: '', interval: '',
  interviews_per_cycle: '', minutes_per_interview: '100', max_seats: '',
  features: [], is_active: false,
};

export default function PlansPage() {
  const { showError, showSuccess } = useSnackbar();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // One dialog, two modes. `editing` holds the row being edited (null in create).
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setF = (k: keyof FormState, v: string | boolean | string[]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    setLoading(true);
    AdminService.plans()
      .then((r) => setRows(r.data?.items ?? []))
      .catch((e: any) => showError(e?.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setErr(null);
    setMode('create');
  };

  const openEdit = (p: PlanRow) => {
    setEditing(p);
    setForm({
      plan_key: p.plan_key,
      name: p.name,
      amount: p.amount == null ? '' : String(p.amount / 100), // paise → rupees
      interval: p.interval ?? '',
      interviews_per_cycle: String(p.interviews_per_cycle),
      minutes_per_interview: String(p.minutes_per_interview),
      max_seats: p.max_seats == null ? '' : String(p.max_seats),
      features: Array.isArray(p.features) ? [...p.features] : [],
      is_active: p.is_active,
    });
    setErr(null);
    setMode('edit');
  };

  const close = () => { setMode(null); setEditing(null); };

  // ── features editor ──
  const addFeature = () => setF('features', [...form.features, '']);
  const setFeature = (i: number, v: string) => setF('features', form.features.map((f, idx) => (idx === i ? v : f)));
  const removeFeature = (i: number) => setF('features', form.features.filter((_, idx) => idx !== i));

  /** Validate + coerce the shared form. Returns the wire body or null (sets err). */
  const buildBody = (): Record<string, unknown> | null => {
    setErr(null);
    if (mode === 'create' && !form.plan_key.trim()) { setErr('Plan key is required.'); return null; }
    if (!form.name.trim()) { setErr('Name is required.'); return null; }

    const interviews = Number(form.interviews_per_cycle);
    if (!Number.isFinite(interviews) || interviews < 0 || form.interviews_per_cycle.trim() === '') {
      setErr('Interviews per cycle must be a number ≥ 0.'); return null;
    }
    const minutes = Number(form.minutes_per_interview);
    if (!Number.isFinite(minutes) || minutes < 1) { setErr('Minutes per interview must be ≥ 1.'); return null; }

    const seats = form.max_seats.trim() === '' ? null : Number(form.max_seats);
    if (seats !== null && (!Number.isFinite(seats) || seats < 1)) { setErr('Max seats must be ≥ 1, or empty for unlimited.'); return null; }

    const amountRupees = form.amount.trim() === '' ? null : Number(form.amount);
    if (amountRupees !== null && (!Number.isFinite(amountRupees) || amountRupees < 0)) { setErr('Amount must be a number ≥ 0.'); return null; }

    const features = form.features.map((f) => f.trim()).filter(Boolean);

    // amount/max_seats: send null on edit to clear; omit on create when blank.
    return {
      name: form.name.trim(),
      interviews_per_cycle: interviews,
      minutes_per_interview: minutes,
      is_active: form.is_active,
      interval: form.interval || null,
      amount: amountRupees === null ? null : Math.round(amountRupees * 100), // rupees → paise
      max_seats: seats,
      features,
    };
  };

  const submit = async () => {
    const body = buildBody();
    if (!body) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        // Create is restricted to CUSTOM plans — you can't spawn duplicate
        // standard tiers. Custom plans are hidden unless explicitly activated.
        await AdminService.createPlan({ ...body, plan_key: form.plan_key.trim(), tier: 'custom' });
        showSuccess('Custom plan created.');
      } else if (editing) {
        await AdminService.updatePlan(editing.id, body);
        showSuccess('Plan updated.');
      }
      close();
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      setErr(e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<DataTableColumn<PlanRow>[]>(
    () => [
      { key: 'key', header: 'Key', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.plan_key}</Box> },
      { key: 'name', header: 'Name', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{p.name}</Box> },
      { key: 'tier', header: 'Tier', width: 100, hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.tier}</Box> },
      { key: 'ipc', header: 'Interviews / cycle', width: 140, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{p.interviews_per_cycle}</Box> },
      { key: 'mpi', header: 'Minutes', width: 100, align: 'right', hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.minutes_per_interview}</Box> },
      { key: 'seats', header: 'Max seats', width: 110, align: 'right', hideOn: 'mobile', render: (p) => <Box sx={{ color: TOKENS.textSecondary }}>{p.max_seats ?? '∞'}</Box> },
      { key: 'amount', header: 'Amount', width: 120, align: 'right', render: (p) => <Box sx={{ color: TOKENS.textPrimary, fontWeight: 600 }}>{rupees(p.amount)}</Box> },
      { key: 'subs', header: 'Companies', width: 110, align: 'right', render: (p) => <Box sx={{ color: p.companies_subscribed > 0 ? TOKENS.textPrimary : TOKENS.textMuted, fontWeight: 600 }}>{p.companies_subscribed}</Box> },
      {
        key: 'active',
        header: 'Active',
        width: 110,
        render: (p) =>
          p.is_active ? (
            <Chip label="Active" size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(76,217,100,0.14)', color: '#047857' }} />
          ) : (
            <Chip label="Hidden" size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, borderColor: TOKENS.border, color: TOKENS.textSecondary }} />
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

  const isCreate = mode === 'create';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.5 }}>Plans</PageTitle>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            Edit any plan’s entitlements and features. Create custom plans for bespoke deals.
          </Secondary>
        </Box>
        <ActionButton onClick={openCreate}>+ Create custom plan</ActionButton>
      </Box>

      <DataTable<PlanRow>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyText="No plans configured."
      />

      <Dialog open={mode !== null} onClose={busy ? undefined : close} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isCreate ? 'Create custom plan' : `Edit plan — ${editing?.name ?? ''}`}
        </DialogTitle>
        <DialogContent>
          {err && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{err}</Alert>}
          <Stack spacing={2} sx={{ mt: err ? 0 : 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {isCreate ? (
                <TextField label="Plan key" placeholder="custom_partner" fullWidth size="small"
                  value={form.plan_key} onChange={(e) => setF('plan_key', e.target.value)}
                  helperText="Unique, lowercase, no spaces" />
              ) : (
                <TextField label="Plan key" fullWidth size="small" value={form.plan_key} disabled
                  helperText={`Tier: ${editing?.tier ?? ''} · not editable`} />
              )}
              <TextField label="Name" placeholder="Partner Plan" fullWidth size="small"
                value={form.name} onChange={(e) => setF('name', e.target.value)} />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Amount" type="number" fullWidth size="small"
                value={form.amount} onChange={(e) => setF('amount', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Empty = free / negotiated" />
              <TextField select label="Interval" fullWidth size="small"
                value={form.interval} onChange={(e) => setF('interval', e.target.value)}
                SelectProps={{ native: true }}>
                <option value="">None (one-time / custom)</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Interviews / cycle" type="number" fullWidth size="small"
                value={form.interviews_per_cycle} onChange={(e) => setF('interviews_per_cycle', e.target.value)} />
              <TextField label="Minutes / interview" type="number" fullWidth size="small"
                value={form.minutes_per_interview} onChange={(e) => setF('minutes_per_interview', e.target.value)} />
              <TextField label="Max seats" type="number" fullWidth size="small"
                value={form.max_seats} onChange={(e) => setF('max_seats', e.target.value)}
                helperText="Empty = unlimited" />
            </Stack>

            {/* ── Features (card bullet list) ── */}
            <Box>
              <Typography sx={{ color: TOKENS.textSecondary, fontWeight: 600, fontSize: '0.8rem', mb: 1 }}>
                Features (shown on the plan card)
              </Typography>
              <Stack spacing={1}>
                {form.features.length === 0 && (
                  <Typography sx={{ color: TOKENS.textMuted, fontSize: '0.8rem' }}>No features yet.</Typography>
                )}
                {form.features.map((feat, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <TextField fullWidth size="small" placeholder="e.g. Priority support"
                      value={feat} onChange={(e) => setFeature(i, e.target.value)} />
                    <IconButton size="small" onClick={() => removeFeature(i)} aria-label={`remove feature ${i + 1}`}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <ActionButton variant="secondary" size="small" onClick={addFeature} startIcon={<AddIcon />}>
                    Add feature
                  </ActionButton>
                </Box>
              </Stack>
            </Box>

            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => setF('is_active', e.target.checked)} />}
              label={form.is_active ? 'Active — shown in the public catalog' : 'Hidden — attach to companies via Assign plan'}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <ActionButton variant="secondary" onClick={close} disabled={busy}>Cancel</ActionButton>
          <ActionButton onClick={submit} loading={busy}>{isCreate ? 'Create' : 'Save'}</ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
