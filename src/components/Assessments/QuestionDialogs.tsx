import { useState } from 'react';
import {
  Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Tooltip, Typography,
} from '@mui/material';
import { MdAdd, MdAutoAwesome, MdDeleteOutline } from 'react-icons/md';
import { FormField } from '../common/FormField';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import { QuestionText } from './QuestionText';
import type { AssessmentQuestion, QuestionFormat, QuestionPatch, RubricLine } from '../../types/assessment.types';

export const FORMAT_LABEL: Record<QuestionFormat, string> = {
  mcq: 'MCQ',
  fill_blank: 'Fill in the blank',
  short_answer: 'Short answer',
  written: 'Written',
  build: 'Build task',
};
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
function RubricEditor({ value, onChange, disabled, weights }: { value: RubricLine[]; onChange: (v: RubricLine[]) => void; disabled?: boolean; weights?: boolean }) {
  const total = value.reduce((s, l) => s + (l.points || 0), 0);
  const set = (i: number, patch: Partial<RubricLine>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {value.map((line, i) => (
        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: disabled ? 'minmax(0,1fr) 88px' : 'minmax(0,1fr) 88px 36px', gap: 1, alignItems: 'start' }}>
          <FormField placeholder={weights ? 'A way the work can break, e.g. Access: users only see their own data' : 'What a correct explanation must show'} value={line.criterion} disabled={disabled} multiline
            // Wraps instead of scrolling sideways; a criterion stays one line of text.
            onChange={(e) => set(i, { criterion: e.target.value.replace(/\n/g, ' ') })} />
          <FormField select value={String(line.points)} disabled={disabled} onChange={(e) => set(i, { points: Number(e.target.value) })}>
            {(weights ? [...new Set([5, 10, 15, 20, 25, 30, 35, 40, 50, line.points])].sort((a, b) => a - b) : [1, 2, 3, 4, 5])
              .map((p) => <MenuItem key={p} value={String(p)}>{p}{weights ? '%' : ` pt${p > 1 ? 's' : ''}`}</MenuItem>)}
          </FormField>
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

const cleanRubric = (r: RubricLine[]) => r.map((l) => ({ ...l, criterion: l.criterion.trim() })).filter((l) => l.criterion);

/**
 * Add or edit a question's rubric by hand, or ask the AI to write or change
 * it. A rubric means the candidate explains their answer.
 */
export function RubricDialog({ question, readOnly, onClose, onSave, onAsk }: {
  question: AssessmentQuestion;
  readOnly: boolean;
  onClose: () => void;
  onSave: (p: QuestionPatch) => Promise<boolean>;
  /** Ask the AI to change the rubric; resolves to the updated question. */
  onAsk: (instruction: string) => Promise<AssessmentQuestion | null>;
}) {
  const had = !!question.rubric?.length;
  const build = question.format === 'build';
  const [rubric, setRubric] = useState<RubricLine[]>(had ? question.rubric! : [{ ...EMPTY_LINE }]);
  const [busy, setBusy] = useState<'save' | 'ai' | 'remove' | null>(null);

  const finish = async (kind: 'save' | 'remove', patch: QuestionPatch) => {
    setBusy(kind);
    const ok = await onSave(patch);
    setBusy(null);
    if (ok) onClose();
  };
  const ask = async (instruction: string) => {
    setBusy('ai');
    const q = await onAsk(instruction);
    setBusy(null);
    if (q?.rubric?.length) setRubric(q.rubric);
    return !!q;
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={DIALOG_PAPER}>
      <DialogTitle sx={{ fontWeight: 700 }}>{had || readOnly ? 'Rubric' : 'Add rubric'} · Q{question.order}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!build && (
          <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary }}>
            {question.format === 'written'
              ? 'The written answer is marked against each line.'
              : "The candidate explains their answer, and the explanation is marked against each line."}
          </Typography>
        )}
        {!readOnly && (
          <AskAi
            placeholder={build ? 'Ask AI to change the rubric' : had ? 'Ask AI to change the rubric' : 'Ask AI to write the rubric'}
            busy={busy === 'ai'}
            onAsk={ask}
            suggestions={build ? ['Weigh access control higher', 'Add a category for the tests they write', 'Fewer categories'] : had ? ['Add a line for units', 'Make it stricter', 'Fewer lines'] : ['Write a rubric for this question']}
          />
        )}
        <RubricEditor value={rubric} onChange={setRubric} disabled={readOnly || !!busy} weights={build} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {!readOnly && had && question.format !== 'written' && !build && (
          <ActionButton variant="secondary" onClick={() => finish('remove', { rubric: null })} loading={busy === 'remove'} disabled={!!busy} sx={{ mr: 'auto' }}>
            Remove rubric
          </ActionButton>
        )}
        <ActionButton variant="secondary" onClick={onClose} disabled={!!busy}>{readOnly ? 'Close' : 'Cancel'}</ActionButton>
        {!readOnly && (
          <ActionButton onClick={() => finish('save', { rubric: cleanRubric(rubric) })} loading={busy === 'save'}
            disabled={!!busy || cleanRubric(rubric).length === 0 || (build && cleanRubric(rubric).reduce((t, l) => t + l.points, 0) !== 100)}>
            Save rubric
          </ActionButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
