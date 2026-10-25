import { useState } from 'react';
import { Box, Chip, CircularProgress, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { MdAutorenew, MdCheckCircle, MdChecklist, MdDeleteOutline, MdEdit, MdWarningAmber } from 'react-icons/md';
import { ActionButton } from '../common/ActionButton';
import { TOKENS } from '../../theme';
import type { AssessmentQuestion } from '../../types/assessment.types';
import { FORMAT_LABEL } from './QuestionDialogs';
import { QuestionText } from './QuestionText';
import { BuildRepoPanel } from './BuildRepoPanel';

const LETTERS = 'ABCDEF';
const WARN_TEXT = '#92400E';
const WARN_BG = '#FEF3C7';
const CHECK_BORDER = '#F59E0B';

function Action({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" aria-label={title} onClick={onClick} disabled={disabled} sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary } }}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function flagText(q: AssessmentQuestion): string {
  if (q.check_answer == null) return "The check couldn't confirm this answer key";
  if (q.format === 'mcq' && typeof q.answer_key === 'number' && typeof q.check_answer === 'number') {
    return `Key ${LETTERS[q.answer_key]} · the check picked ${LETTERS[q.check_answer]}`;
  }
  return `The check answered "${q.check_answer}", which isn't in the answer key`;
}

export function QuestionCard({ assessmentId, q, single, readOnly, busy, disabled, onEdit, onRegenerate, onRubric, onDelete, onAcceptKey, onSetKey }: {
  assessmentId: string;
  /** The only question on the paper: no "Q1" label. */
  single?: boolean;
  q: AssessmentQuestion;
  readOnly: boolean;
  /** This card is waiting on its own action. */
  busy: boolean;
  /** Some action is running on the page. */
  disabled: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onRubric: () => void;
  onDelete: () => void;
  onAcceptKey: () => void;
  /** Set the answer key by hand: an option index (MCQ) or accepted forms. */
  onSetKey: (key: number | string[]) => void;
}) {
  const flagged = q.check_status === 'flagged';
  const editable = !readOnly && !disabled;
  const [textKey, setTextKey] = useState<string | null>(null);
  const saveTextKey = () => {
    const forms = (textKey ?? '').split(',').map((a) => a.trim()).filter(Boolean);
    setTextKey(null);
    if (forms.length && forms.join(',') !== (q.answer_key as string[]).join(',')) onSetKey(forms);
  };
  const hasRubric = !!q.rubric?.length;
  const build = q.format === 'build';

  return (
    <Box sx={{
      border: `1px solid ${flagged ? '#F59E0B' : TOKENS.border}`, borderRadius: '12px', bgcolor: '#fff',
      p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, opacity: busy ? 0.6 : 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {!single && <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: TOKENS.textPrimary, mr: 0.5 }}>Q{q.order}</Typography>}
        <Chip size="small" label={FORMAT_LABEL[q.format]} sx={{ bgcolor: TOKENS.borderLight, fontWeight: 600 }} />
        {q.format === 'build' && q.deliverable_type && q.deliverable_type !== 'code' && (
          <Chip size="small" label={q.deliverable_type.replace('_', ' ')} sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', textTransform: 'capitalize', fontWeight: 600 }} />
        )}
        <Chip size="small" label={q.topic} sx={{ bgcolor: TOKENS.borderLight }} />
        <Chip size="small" label={q.difficulty} sx={{ bgcolor: TOKENS.borderLight, textTransform: 'capitalize' }} />
        {hasRubric && q.format !== 'written' && !build && <Chip size="small" label="Explain" sx={{ bgcolor: TOKENS.brandBg, color: TOKENS.success, fontWeight: 600 }} />}
        {flagged && <Chip size="small" icon={<MdWarningAmber />} label="Flagged" sx={{ bgcolor: WARN_BG, color: WARN_TEXT, fontWeight: 600, '& .MuiChip-icon': { color: WARN_TEXT } }} />}
        {q.check_status === 'accepted' && <Chip size="small" label="Key accepted" sx={{ bgcolor: TOKENS.borderLight, color: TOKENS.textSecondary }} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mt: -0.5 }}>
        {busy && <CircularProgress size={16} sx={{ color: TOKENS.brand, mr: 0.5 }} />}
        {!readOnly && <Action title="Edit" onClick={onEdit} disabled={disabled}><MdEdit /></Action>}
        {!readOnly && <Action title={build ? 'Regenerate the repo' : 'Regenerate'} onClick={onRegenerate} disabled={disabled || q.check_status === 'generating'}><MdAutorenew /></Action>}
        {(hasRubric || !readOnly) && (
          <Action title={build ? (readOnly ? 'View rubric' : 'Rubric') : readOnly ? 'View rubric' : hasRubric ? 'Rubric' : 'Add rubric'} onClick={onRubric} disabled={!readOnly && disabled}>
            <Box component="span" sx={{ display: 'flex', color: hasRubric ? TOKENS.success : 'inherit' }}><MdChecklist /></Box>
          </Action>
        )}
        {!readOnly && <Action title="Delete" onClick={onDelete} disabled={disabled}><MdDeleteOutline /></Action>}
      </Box>
      </Box>

      <QuestionText text={q.prompt} />

      {q.format === 'mcq' && q.options && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
          {q.options.map((o, i) => {
            const key = i === q.answer_key;
            const checkPick = flagged && i === q.check_answer;
            const pickable = editable && !key;
            return (
              <Box
                key={i}
                {...(pickable && {
                  role: 'button', tabIndex: 0, title: 'Set as answer key',
                  onClick: () => onSetKey(i),
                  onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onSetKey(i),
                })}
                sx={{
                  display: 'flex', gap: 1, alignItems: 'flex-start', px: 1.25, py: 0.75, borderRadius: '8px', fontSize: '0.85rem',
                  bgcolor: key ? TOKENS.brandBg : checkPick ? WARN_BG : TOKENS.bg, color: TOKENS.textPrimary, fontWeight: key || checkPick ? 600 : 400,
                  border: `1px solid ${checkPick ? CHECK_BORDER : pickable ? TOKENS.border : 'transparent'}`, cursor: pickable ? 'pointer' : 'default',
                  '&:hover': pickable ? { borderColor: TOKENS.brand } : undefined,
                  '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` },
                }}
              >
                <Box component="span" sx={{ color: TOKENS.textSecondary, minWidth: 16 }}>{LETTERS[i]}</Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{o}</Box>
                {key && <Box component="span" sx={{ color: TOKENS.success, display: 'flex' }} aria-label="Answer key"><MdCheckCircle /></Box>}
                {checkPick && <Box component="span" sx={{ color: WARN_TEXT, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Check's pick</Box>}
              </Box>
            );
          })}
        </Box>
      )}

      {Array.isArray(q.answer_key) && (
        textKey !== null ? (
          <TextField
            autoFocus size="small" value={textKey} onChange={(e) => setTextKey(e.target.value)}
            onBlur={saveTextKey}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTextKey(); if (e.key === 'Escape') setTextKey(null); }}
            helperText="Separate different correct forms with commas. Enter to save, Esc to cancel."
            inputProps={{ 'aria-label': 'Answer key' }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.85rem' } }}
          />
        ) : (
          <Typography
            {...(editable && {
              role: 'button', tabIndex: 0, title: 'Edit answer key',
              onClick: () => setTextKey((q.answer_key as string[]).join(', ')),
              onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && setTextKey((q.answer_key as string[]).join(', ')),
            })}
            sx={{
              fontSize: '0.85rem', color: TOKENS.textPrimary, alignSelf: 'flex-start', px: 1, py: 0.5, mx: -1, borderRadius: '8px',
              cursor: editable ? 'pointer' : 'default', border: '1px solid transparent',
              '&:hover': editable ? { borderColor: TOKENS.brand } : undefined,
              '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` },
            }}
          >
            <Box component="span" sx={{ color: TOKENS.textSecondary }}>Answer key: </Box>
            {q.answer_key.join(' · ')}
          </Typography>
        )
      )}

      {build && !!q.rubric?.length && (
        <Box sx={{ border: `1px solid ${TOKENS.borderLight}`, borderRadius: '10px', px: 1.5, py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: TOKENS.textPrimary, flex: 1 }}>Rubric</Typography>
            <Box component="button" type="button" onClick={onRubric} disabled={!readOnly && disabled}
              sx={{ all: 'unset', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: TOKENS.success, '&:disabled': { opacity: 0.5, cursor: 'default' }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
              {readOnly ? 'View' : 'Edit'}
            </Box>
          </Box>
          {q.rubric.map((l) => (
            <Box key={l.criterion} sx={{ display: 'flex', gap: 1.5, py: 0.5, fontSize: '0.82rem', color: TOKENS.textPrimary, borderTop: `1px solid ${TOKENS.borderLight}`, '&:first-of-type': { borderTop: 0 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>{l.criterion.split(':')[0]}</Box>
                {l.criterion.includes(':') && <Box sx={{ color: TOKENS.textMuted, fontSize: '0.76rem' }}>{l.criterion.split(':').slice(1).join(':').trim()}</Box>}
              </Box>
              <Box component="span" sx={{ color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{l.points}%</Box>
            </Box>
          ))}
        </Box>
      )}
      {build && <BuildRepoPanel assessmentId={assessmentId} q={q} />}

      {q.format === 'written' && (
        <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary }}>Written answer · marked against the rubric</Typography>
      )}

      {flagged && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', bgcolor: WARN_BG, borderRadius: '8px', px: 1.25, py: 0.75 }}>
          <Typography sx={{ fontSize: '0.8rem', color: WARN_TEXT, flex: 1, minWidth: 0 }}>
            {flagText(q)}.{' '}
            {q.format === 'mcq'
              ? 'Green is our answer key, orange is what the check picked. Click the orange option to use it, or accept our key.'
              : 'Add the check\'s answer to the key if it\'s also correct, or accept our key.'}
          </Typography>
          {!readOnly && Array.isArray(q.answer_key) && typeof q.check_answer === 'string' && (
            <ActionButton size="small" variant="secondary" disabled={disabled}
              onClick={() => onSetKey([...(q.answer_key as string[]), q.check_answer as string])}>
              Add "{q.check_answer}" to key
            </ActionButton>
          )}
          {!readOnly && <ActionButton size="small" onClick={onAcceptKey} disabled={disabled}>Accept key</ActionButton>}
        </Box>
      )}
    </Box>
  );
}
