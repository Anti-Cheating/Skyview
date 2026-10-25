import { useState } from 'react';
import {
  Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography,
} from '@mui/material';
import { MdAdd, MdAutoAwesome, MdDeleteOutline } from 'react-icons/md';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { QuestionText } from './QuestionText';
import type { AssessmentQuestion, QuestionFormat, RubricLine } from '../../types/assessment.types';

export const FORMAT_LABEL: Record<QuestionFormat, string> = {
  mcq: 'Single correct',
  multi: 'Multiple correct',
  fill_blank: 'Fill in the blank',
  short_answer: 'Short answer',
  written: 'Written',
  build: 'Build task',
};
/** Answered by picking options. */
export const isChoice = (f: QuestionFormat) => f === 'mcq' || f === 'multi';

/** The correct option indexes: one for mcq, several for multi, none otherwise. */
export function keyedOptions(q: { format: QuestionFormat; answer_key: unknown }): number[] {
  if (q.format === 'mcq' && typeof q.answer_key === 'number') return [q.answer_key];
  if (q.format === 'multi' && Array.isArray(q.answer_key)) return q.answer_key as number[];
  return [];
}

/** Accepted typed answers (fill in the blank / short answer), else null. */
export const textKeys = (q: { format: QuestionFormat; answer_key: unknown }): string[] | null =>
  (q.format === 'fill_blank' || q.format === 'short_answer') && Array.isArray(q.answer_key) ? (q.answer_key as string[]) : null;

const EMPTY_LINE: RubricLine = { criterion: '', points: 1 };
const DIALOG_PAPER = { sx: { borderRadius: '16px' } };

/** Text box + suggestion chips for telling the AI what to change. */
function AskAi({ placeholder, suggestions, busy, onAsk }: {
  placeholder: string; suggestions: string[]; busy: boolean; onAsk: (instruction: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const ask = async (value = text) => {
    if (!value.trim() || busy) return;
    if (await onAsk(value.trim())) setText('');
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth multiline minRows={2} maxRows={6} size="small" placeholder={placeholder} value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          inputProps={{ 'aria-label': placeholder }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.875rem' } }}
        />
        <ActionButton onClick={() => ask()} loading={busy} disabled={!text.trim()} startIcon={<MdAutoAwesome />}>Apply</ActionButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {suggestions.map((s) => (
          <Chip key={s} label={s} size="small" onClick={() => ask(s)} disabled={busy} sx={{ bgcolor: TOKENS.bg, border: `1px solid ${TOKENS.border}` }} />
        ))}
      </Box>
    </Box>
  );
}

/** Edit one question by telling the AI what to change. */
export function AiEditDialog({ question, onClose, onAsk }: {
  question: AssessmentQuestion; onClose: () => void; onAsk: (instruction: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const ask = async (instruction: string) => {
    setBusy(true);
    const ok = await onAsk(instruction);
    setBusy(false);
    if (ok) onClose();
    return ok;
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={DIALOG_PAPER}>
      <DialogTitle sx={{ fontWeight: 700 }}>Edit Q{question.order}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ bgcolor: TOKENS.bg, borderRadius: '10px', p: 1.5 }}>
          <QuestionText text={question.prompt} />
        </Box>
        <AskAi
          placeholder="What should change in this question?"
          busy={busy}
          onAsk={ask}
          suggestions={['Make it harder', 'Make it easier', 'Change the numbers', 'Ask for an explanation', 'Turn it into fill in the blank']}
        />
        <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary }}>
          Only this question changes. Its answer key is checked again after the edit.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</ActionButton>
      </DialogActions>
    </Dialog>
  );
}

/** Editable list of rubric lines with points. */
export function RubricEditor({ value, onChange, disabled, weights }: { value: RubricLine[]; onChange: (v: RubricLine[]) => void; disabled?: boolean; weights?: boolean }) {
  const total = value.reduce((s, l) => s + (l.points || 0), 0);
  const set = (i: number, patch: Partial<RubricLine>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {value.map((line, i) => (
        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: disabled ? 'minmax(0,1fr) 88px' : 'minmax(0,1fr) 88px 36px', gap: 1, alignItems: 'start' }}>
          <FormField placeholder={weights ? 'A way the work can break, e.g. Access: users only see their own data' : 'What a correct explanation must show'} value={line.criterion} disabled={disabled} multiline
            // Wraps instead of scrolling sideways; a criterion stays one line of text.
            onChange={(e) => set(i, { criterion: e.target.value.replace(/\n/g, ' ') })} />
          {/* Typed, not picked: weights are % (they add up to 100); marks are 1-10 points. */}
          <FormField type="number" value={line.points ? String(line.points) : ''} disabled={disabled}
            onChange={(e) => set(i, { points: Math.max(0, Math.min(weights ? 100 : 10, Math.round(Number(e.target.value) || 0))) })}
            inputProps={{ min: 1, max: weights ? 100 : 10, 'aria-label': weights ? 'Weight in percent' : 'Points' }}
            InputProps={{ endAdornment: <Box component="span" sx={{ color: TOKENS.textMuted, fontSize: '0.8rem', pl: 0.5 }}>{weights ? '%' : 'pts'}</Box> }} />
          {!disabled && (
            <Tooltip title="Remove line">
              <span>
                <IconButton size="small" aria-label="Remove rubric line" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length <= 1}>
                  <MdDeleteOutline />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!disabled ? (
          <ActionButton variant="secondary" size="small" startIcon={<MdAdd />} onClick={() => onChange([...value, { ...EMPTY_LINE }])}>
            Add line
          </ActionButton>
        ) : <span />}
        <Typography sx={{ fontSize: '0.8rem', color: weights && total !== 100 ? '#B91C1C' : TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
          Total: {total}{weights ? '% (must be 100%)' : ' pts'}
        </Typography>
      </Box>
    </Box>
  );
}
