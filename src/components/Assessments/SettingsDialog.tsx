import { useState, type ReactNode } from 'react';
import { Box, Dialog, DialogContent, IconButton, MenuItem, Switch, Typography } from '@mui/material';
import { MdClose, MdDeleteOutline, MdLock, MdTune } from 'react-icons/md';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import type { Assessment, DeliverableType, NegativeAppliesTo } from '../../types/assessment.types';
import { AssessmentService } from '../../services/assessment.service';
import { DELIVERABLES } from './deliverables';
import { DurationInput, durationError } from './DurationInput';
import { fmt, marksLabel, paperMax } from './marks';
import { NegativeMarking, appliesToOf } from './NegativeMarking';

type Patch = Parameters<typeof AssessmentService.updateSettings>[1];

/**
 * The ⚙ on an assessment: its settings (editable while it's a draft) and
 * Cancel assessment at the bottom.
 */
export function SettingsDialog({ a, onClose, onSave, onCancelAssessment, busy }: {
  a: Assessment;
  onClose: () => void;
  onSave: (patch: Patch) => Promise<boolean>;
  onCancelAssessment: () => void;
  busy: boolean;
}) {
  const draft = a.status === 'draft';
  const live = a.mode === 'live';
  const [title, setTitle] = useState(a.title);
  const [role, setRole] = useState(a.role ?? '');
  const [minutes, setMinutes] = useState(a.duration_min);
  const [deliverable, setDeliverable] = useState<DeliverableType>(a.deliverable_type ?? 'code');
  const [helper, setHelper] = useState(a.helper_required !== false);
  const [minus, setMinus] = useState(fmt(a.negative_marks ?? 0));
  const startTarget = appliesToOf(a.questions);
  const [target, setTarget] = useState<NegativeAppliesTo>(startTarget);
  const neg = Number(minus);
  const minusOk = minus.trim() !== '' && neg >= 0 && neg <= 100;
  const ok = !!title.trim() && !durationError(a.mode, minutes) && minusOk;

  const save = async () => {
    const patch: Patch = {};
    if (title.trim() !== a.title) patch.title = title.trim();
    if (role.trim() !== (a.role ?? '')) patch.role = role.trim() || null;
    if (minutes !== a.duration_min) patch.duration_min = minutes;
    if (!live && deliverable !== (a.deliverable_type ?? 'code')) patch.deliverable_type = deliverable;
    if (live && helper !== (a.helper_required !== false)) patch.helper_required = helper;
    // A bulk action: re-applies the minus to the picked type(s) whenever either part changes.
    if (live && (neg !== (a.negative_marks ?? 0) || target !== startTarget)) { patch.negative_marks = neg; patch.negative_applies_to = target; }
    if (!Object.keys(patch).length || (await onSave(patch))) onClose();
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px', overflow: 'hidden' } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: TOKENS.brandBg, color: TOKENS.success, fontSize: '1.3rem', flexShrink: 0 }} aria-hidden><MdTune /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.05rem', color: TOKENS.textPrimary, lineHeight: 1.3 }}>Settings</Typography>
          <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={busy} sx={{ color: TOKENS.textSecondary }}><MdClose /></IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
        {!draft && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.5, py: 1, borderRadius: '10px', bgcolor: TOKENS.bg, fontSize: '0.82rem', color: TOKENS.textSecondary }}>
            <MdLock aria-hidden /> Settings are locked once it's live.
          </Box>
        )}

        <Section title="Details">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '3fr 2fr' }, gap: 1.5 }}>
            <FormField label="Title" value={title} disabled={!draft} onChange={(e) => setTitle(e.target.value)} error={!title.trim()} />
            <FormField label="Role" optional value={role} disabled={!draft} onChange={(e) => setRole(e.target.value)} />
          </Box>
        </Section>

        <Section title={live ? 'Time limit' : 'Time to finish'}>
          <DurationInput mode={a.mode} value={minutes} onChange={setMinutes} disabled={!draft} />
        </Section>

        {!live && (
          <Section title="Hand in">
            <FormField select value={deliverable} disabled={!draft} onChange={(e) => setDeliverable(e.target.value as DeliverableType)}>
              {DELIVERABLES.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </FormField>
          </Section>
        )}

        {live && (
          <Section title="Marking" aside={<Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '999px', bgcolor: TOKENS.brandBg, color: '#047857', fontSize: '0.75rem', fontWeight: 700 }}>{marksLabel(paperMax(a.questions))}</Box>}>
            <NegativeMarking value={minus} onValue={setMinus} appliesTo={target} onAppliesTo={setTarget} disabled={!draft} />
          </Section>
        )}

        {live && (
          <Section title="Monitoring" last>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: '12px', border: `1px solid ${TOKENS.border}`, cursor: draft ? 'pointer' : 'default' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: TOKENS.textPrimary }}>Trueyy Helper</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: TOKENS.textSecondary }}>{helper ? 'Watches for other apps, pasting and voices.' : 'Off: a plain timed test.'}</Typography>
              </Box>
              <Switch checked={helper} disabled={!draft} onChange={(e) => setHelper(e.target.checked)} />
            </Box>
          </Section>
        )}
      </DialogContent>

      {/* Footer: the destructive action sits apart on the left */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 2, borderTop: `1px solid ${TOKENS.borderLight}`, bgcolor: TOKENS.bg }}>
        {a.status !== 'cancelled' && (
          <Box component="button" type="button" onClick={onCancelAssessment} disabled={busy}
            sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#B91C1C', fontWeight: 600, fontSize: '0.85rem', px: 1, py: 0.75, borderRadius: '8px', '&:hover': { bgcolor: '#FEF2F2' }, '&:focus-visible': { outline: '2px solid #B91C1C' } }}>
            <MdDeleteOutline aria-hidden /> Cancel assessment
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>{draft ? 'Cancel' : 'Close'}</ActionButton>
        {draft && <ActionButton onClick={save} loading={busy} disabled={!ok}>Save changes</ActionButton>}
      </Box>
    </Dialog>
  );
}

/** One block of the dialog: a small heading, then its controls. */
function Section({ title, aside, last, children }: { title: string; aside?: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <Box sx={{ py: 2, borderBottom: last ? 0 : `1px solid ${TOKENS.borderLight}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.textSecondary }}>{title}</Typography>
        {aside}
      </Box>
      {children}
    </Box>
  );
}
