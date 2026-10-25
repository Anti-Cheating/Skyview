import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, FormControlLabel, Switch, Tooltip, Typography } from '@mui/material';
import { MdAssignment, MdCheckCircle, MdQuiz } from 'react-icons/md';
import { DELIVERABLES } from './deliverables';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { Breadcrumb } from '../common/Breadcrumb';
import { PageTitle } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { AssessmentMode, DeliverableType, NegativeAppliesTo } from '../../types/assessment.types';
import { NegativeMarking } from './NegativeMarking';
import { DurationInput, durationError } from './DurationInput';

const KINDS: Array<{ value: AssessmentMode; title: string; line: string; icon: ReactNode }> = [
  { value: 'live', title: 'Aptitude test', line: 'Timed questions in one sitting', icon: <MdQuiz /> },
  { value: 'take_home', title: 'Assignment', line: 'A real task they hand in', icon: <MdAssignment /> },
];

const Label = ({ children }: { children: ReactNode }) => (
  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: TOKENS.textPrimary, mb: 1 }}>{children}</Typography>
);

/** Pick-one pills (a radio group). */
function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string; icon?: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Box key={o.value} component="button" type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            sx={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75, px: 1.75, py: 0.75, borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600,
              border: `1px solid ${on ? TOKENS.brand : TOKENS.border}`, bgcolor: on ? TOKENS.brandBg : '#fff', color: on ? '#047857' : TOKENS.textSecondary,
              '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
            }}>
            {o.icon && <Box component="span" sx={{ display: 'flex', fontSize: '1.05rem' }}>{o.icon}</Box>}
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

/** /assessments/new: what kind, its name and its time. Opens the builder once created. */
export default function NewAssessmentPage() {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const [params] = useSearchParams();
  // ?type=take_home (from "Create a new assignment") opens with Assignment picked.
  const [mode, setMode] = useState<AssessmentMode>(params.get('type') === 'take_home' ? 'take_home' : 'live');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [minutes, setMinutes] = useState(mode === 'live' ? 60 : 2 * 1440);
  const [helper, setHelper] = useState(true);
  const [minus, setMinus] = useState('0');
  const [target, setTarget] = useState<NegativeAppliesTo>('both');
  const [deliverable, setDeliverable] = useState<DeliverableType>('code');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const live = mode === 'live';

  const create = async () => {
    if (!title.trim()) { setTitleError(true); return; }
    if (durationError(mode, minutes)) return; // the time field already says what's wrong
    setSaving(true);
    try {
      const r = await AssessmentService.create({
        title: title.trim(),
        role: role.trim() || null,
        mode,
        duration_min: minutes,
        ...(live ? { helper_required: helper, negative_marks: Math.min(100, Number(minus) || 0), negative_applies_to: target } : { deliverable_type: deliverable }),
      });
      if (r.success && r.data) navigate(`/assessments/${r.data.id}`);
      else showError(r.message || 'Could not create the assessment');
    } catch (e: any) {
      showError(e?.message || 'Could not create the assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 } }}>
      <PageTitle sx={{ color: TOKENS.textPrimary, mb: 0.75 }}>New assessment</PageTitle>
      <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: 'New assessment' }]} />

      <Box component="form" onSubmit={(e) => { e.preventDefault(); void create(); }}
        sx={{ mt: 3, borderRadius: '16px', border: `1px solid ${TOKENS.border}`, bgcolor: '#fff', p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
        <Box>
          <Label>Type</Label>
          <Box role="radiogroup" aria-label="Type" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {KINDS.map((k) => {
              const on = mode === k.value;
              return (
                <Box key={k.value} component="button" type="button" role="radio" aria-checked={on} onClick={() => { if (k.value !== mode) { setMode(k.value); setMinutes(k.value === 'live' ? 60 : 2 * 1440); } }}
                  sx={{
                    all: 'unset', boxSizing: 'border-box', cursor: 'pointer', px: 2, py: 1.5, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 1.5,
                    border: `${on ? 2 : 1}px solid ${on ? TOKENS.brand : TOKENS.border}`, bgcolor: on ? TOKENS.brandBg : '#fff',
                    '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                  }}>
                  <Box sx={{ display: 'flex', fontSize: '1.4rem', color: on ? TOKENS.success : TOKENS.textSecondary }}>{k.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: TOKENS.textPrimary }}>{k.title}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary }}>{k.line}</Typography>
                  </Box>
                  {on && <Box sx={{ color: TOKENS.success, display: 'flex', fontSize: '1.2rem' }} aria-hidden><MdCheckCircle /></Box>}
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <FormField id="new-title" label="Title" required placeholder={live ? 'Backend aptitude' : 'Booking API assignment'} value={title}
            error={titleError} helperText={titleError ? 'Give it a title' : undefined}
            onChange={(e) => { setTitle(e.target.value); setTitleError(false); }} />
          <FormField id="new-role" label="Role" optional placeholder="Backend Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
        </Box>

        {!live && (
          <Box>
            <Label>Hand in</Label>
            <Pills label="Hand in" value={deliverable} options={DELIVERABLES} onChange={setDeliverable} />
            <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, mt: 1 }}>
              Candidates can hand in: {DELIVERABLES.find((d) => d.value === deliverable)!.accepts}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexWrap: 'wrap' }}>
          <Box>
            <Label>{live ? 'Time limit' : 'Time to finish'}</Label>
            <DurationInput mode={mode} value={minutes} onChange={setMinutes} />
          </Box>
          {live && (
            // Off = a plain timed test: nothing to install, no monitoring, no integrity check.
            <Tooltip title={helper ? 'Watches for other apps, pasting and voices' : 'Off: a plain timed test, nothing to install'}>
              <FormControlLabel sx={{ m: 0, pb: 0.5 }}
                control={<Switch checked={helper} onChange={(e) => setHelper(e.target.checked)} />}
                label={<Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textPrimary }}>Trueyy Helper</Typography>} />
            </Tooltip>
          )}
        </Box>

        {live && <NegativeMarking value={minus} onValue={setMinus} appliesTo={target} onAppliesTo={setTarget} />}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <ActionButton variant="secondary" onClick={() => navigate('/assessments')} disabled={saving}>Cancel</ActionButton>
          <ActionButton type="submit" loading={saving}>Create</ActionButton>
        </Box>
      </Box>
    </Box>
  );
}
