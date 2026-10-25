import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { MdCheckCircle } from 'react-icons/md';
import { TOKENS } from '../../theme';
import type { AssessmentQuestion } from '../../types/assessment.types';
import { RubricBar, metaLine } from './EditableQuestion';
import { marksWithMinus } from './marks';
import { QuestionText } from './QuestionText';
import { isChoice, keyedOptions, textKeys } from './QuestionDialogs';

const LETTERS = 'ABCDEF';

export function flagText(q: AssessmentQuestion): string {
  if (q.check_answer == null) return "The check couldn't confirm this answer key";
  if (q.format === 'mcq' && typeof q.answer_key === 'number' && typeof q.check_answer === 'number') {
    return `Key ${LETTERS[q.answer_key]} · the check picked ${LETTERS[q.check_answer]}`;
  }
  if (q.format === 'multi' && Array.isArray(q.check_answer)) {
    const letters = (ix: number[]) => ix.map((i) => LETTERS[i]).join(', ');
    return `Key ${letters(keyedOptions(q))} · the check picked ${letters(q.check_answer)}`;
  }
  return `The check answered "${q.check_answer}", which isn't in the answer key`;
}

/** A question of a finalized paper, read-only. Drafts are edited in place (EditableQuestion). */
export function QuestionCard({ q, single }: { q: AssessmentQuestion; single?: boolean }) {
  const build = q.format === 'build';
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ flexShrink: 0, border: `1px solid ${TOKENS.border}`, borderRadius: '14px', bgcolor: '#fff', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, containerType: 'inline-size' }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {!single && <Typography sx={{ fontWeight: 700, color: TOKENS.textSecondary, minWidth: 16 }}>{q.order}</Typography>}
        <Box sx={{ flex: 1, minWidth: 0 }}><QuestionText text={q.prompt} /></Box>
      </Box>

      <Box sx={{ pl: single ? 0 : 3.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {isChoice(q.format) && q.options && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, '@container (max-width: 520px)': { gridTemplateColumns: '1fr' } }}>
            {q.options.map((o, i) => {
              const key = keyedOptions(q).includes(i);
              return (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', px: 1.25, py: 0.9, borderRadius: '10px', fontSize: '0.875rem', bgcolor: key ? TOKENS.brandBg : TOKENS.bg, color: TOKENS.textPrimary, fontWeight: key ? 600 : 400 }}>
                  <Box component="span" sx={{ color: TOKENS.textSecondary, minWidth: 16 }}>{LETTERS[i]}</Box>
                  <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{o}</Box>
                  {key && <Box component="span" sx={{ color: TOKENS.success, display: 'flex' }} aria-label="Correct answer"><MdCheckCircle /></Box>}
                </Box>
              );
            })}
          </Box>
        )}

        {textKeys(q) && (
          <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textPrimary }}>
            <Box component="span" sx={{ color: TOKENS.textSecondary }}>Accepted answers: </Box>{textKeys(q)!.join(' · ')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {q.format !== 'build' && <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary }}>{metaLine(q)}</Typography>}
          {q.format !== 'build' && <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, ml: 'auto' }}>{marksWithMinus(q)}</Typography>}
        </Box>

      </Box>

      {!!q.rubric?.length && (
        <RubricBar q={q} open={open} onToggle={() => setOpen((v) => !v)} pad="20px">
          {q.rubric.map((l) => (
            <Box key={l.criterion} sx={{ display: 'flex', gap: 1.5, py: 0.5, fontSize: '0.82rem', color: TOKENS.textPrimary }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>{l.criterion}</Box>
              <Box component="span" sx={{ color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.points}{build ? '%' : ` pt${l.points > 1 ? 's' : ''}`}</Box>
            </Box>
          ))}
        </RubricBar>
      )}
    </Box>
  );
}
