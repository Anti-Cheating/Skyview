import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography,
  MenuItem, Alert,
} from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { AdminService } from '../../services/admin.service';

interface PlanOption {
  id: string;
  plan_key: string;
  name: string;
  tier: string;
  interviews_per_cycle: number;
  max_seats: number | null;
  minutes_per_interview: number;
  is_active: boolean;
  companies_subscribed: number;
}

export interface PlanDialogProps {
  open: boolean;
  companyId: string;
  companyName?: string;
  onClose: () => void;
  /** Called after a successful assign so the parent can refetch. */
  onDone: () => void;
}

/**
 * Assign a plan to one company — point its subscription at ANY plan (catalog
 * or a hidden/custom one created in the Plans tab). Warns when the chosen plan
 * is shared by other companies so an edit-safety footgun is visible before
 * committing. Custom plans are authored in the Plans tab, not here.
 *
 * Assigning resets the company's interview meter to the plan's cycle quota.
 */
export default function PlanDialog({ open, companyId, companyName, onClose, onDone }: PlanDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setSelectedId('');
    setPlansLoading(true);
    AdminService.plans()
      .then((r) => setPlans((r.data?.items ?? []) as PlanOption[]))
      .catch((e: any) => setError(e?.message || 'Failed to load plans'))
      .finally(() => setPlansLoading(false));
  }, [open]);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  const submit = async () => {
    setError(null);
    if (!selectedId) { setError('Pick a plan first.'); return; }
    setBusy(true);
    try {
      await AdminService.assignPlan(companyId, { plan_id: selectedId });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ color: TOKENS.textPrimary, fontWeight: 700 }}>Assign plan</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: TOKENS.textSecondary, mb: 2, fontSize: '0.85rem' }}>
          Point {companyName ?? 'this company'} at any plan. Their interview meter resets to the plan&apos;s cycle quota.
          To make a bespoke plan first, use the Plans tab.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          select fullWidth size="small" label={plansLoading ? 'Loading plans…' : 'Plan'}
          value={selectedId} disabled={plansLoading}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {plans.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} · {p.interviews_per_cycle} interviews · {p.max_seats == null ? 'unlimited' : p.max_seats} seats
              {p.is_active ? '' : ' · hidden'}
            </MenuItem>
          ))}
        </TextField>
        {selected && selected.companies_subscribed > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {selected.companies_subscribed} {selected.companies_subscribed === 1 ? 'company is' : 'companies are'} already
            on “{selected.name}” — future edits to it will affect all of them.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
        <ActionButton onClick={submit} loading={busy}>Assign</ActionButton>
      </DialogActions>
    </Dialog>
  );
}
