import { Box, CircularProgress, Typography } from '@mui/material';
import { MdCheck } from 'react-icons/md';
import { TOKENS } from '../../theme';
import type { ChatEvent } from '../../types/assessment.types';
import { FORMAT_LABEL } from './QuestionDialogs';
import { QuestionText } from './QuestionText';

type Stage = 'reading' | 'writing' | 'checking' | 'saving';
type Draft = Extract<ChatEvent, { type: 'draft' }>['question'];

/** What one chat turn has done so far, folded from its streamed events. */
export interface TurnProgress {
  stage: Stage;
  plan: string | null;
  drafts: Draft[];
  checked: number;
  total: number;
}

export const START_PROGRESS: TurnProgress = { stage: 'reading', plan: null, drafts: [], checked: 0, total: 0 };

export function foldProgress(p: TurnProgress, e: ChatEvent): TurnProgress {
  switch (e.type) {
    case 'stage': return { ...p, stage: e.stage, total: e.total ?? p.total };
    case 'plan': return { ...p, plan: e.text };
    case 'draft': return { ...p, drafts: [...p.drafts, e.question] };
    case 'check': return { ...p, checked: e.done, total: e.total };
  }
}

const ORDER: Stage[] = ['reading', 'writing', 'checking', 'saving'];

function Step({ state, label, detail }: { state: 'done' | 'active'; label: string; detail?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Box sx={{ width: 16, height: 16, mt: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {state === 'done'
          ? <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: TOKENS.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}><MdCheck /></Box>
          : <CircularProgress size={13} thickness={5} sx={{ color: TOKENS.brand }} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: state === 'active' ? 600 : 500, color: state === 'active' ? TOKENS.textPrimary : TOKENS.textSecondary }}>{label}</Typography>
        {detail && <Typography component="div" sx={{ fontSize: '0.78rem', color: TOKENS.textSecondary, mt: 0.25 }}>{detail}</Typography>}
      </Box>
    </Box>
  );
}

/** The AI's working steps in the chat, like "Planned · Writing questions · 3 ready". */
export function ChatProgressSteps({ p }: { p: TurnProgress }) {
  const at = ORDER.indexOf(p.stage);
  const state = (s: Stage) => (ORDER.indexOf(s) < at ? 'done' : 'active') as 'done' | 'active';
  const n = p.drafts.length;
  return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Step state={at > 0 ? 'done' : 'active'} label={at > 0 ? 'Read your request' : 'Reading your request'} />
      {at >= 1 && (
        <Step state={p.plan ? 'done' : 'active'} label={p.plan ? 'Planned' : 'Planning the paper'}
          detail={p.plan && <Box component="span" sx={{ fontStyle: 'italic' }}>{p.plan}</Box>} />
      )}
      {at >= 1 && p.plan && (n > 0 || at === 1) && (
        <Step state={state('writing')} label={at > 1 ? `Wrote ${n} question${n === 1 ? '' : 's'}` : 'Writing questions'}
          detail={at === 1 ? (n ? `${n} ready` : 'Starting…') : undefined} />
      )}
      {at >= 2 && p.total > 0 && (
        <Step state={state('checking')} label={at > 2 ? 'Checked the answers' : 'Checking answers with a second model'}
          detail={`${p.checked} of ${p.total}`} />
      )}
      {at >= 3 && <Step state="active" label="Saving to the paper" />}
    </Box>
  );
}

/** A question the AI has written but not saved yet, shown in the paper as it arrives. */
export function DraftCard({ q, checking }: { q: Draft; checking: boolean }) {
  return (
    <Box sx={{ border: `1px dashed ${TOKENS.brand}`, borderRadius: '12px', bgcolor: '#fff', p: 2, display: 'flex', flexDirection: 'column', gap: 1, opacity: 0.85,
      animation: 'asmtIn 0.25s ease-out', '@keyframes asmtIn': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 0.85, transform: 'none' } },
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: TOKENS.success }}>New</Typography>
        {q.format && <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, bgcolor: TOKENS.borderLight, borderRadius: '12px', px: 1, py: 0.25 }}>{FORMAT_LABEL[q.format]}</Box>}
        {q.difficulty && <Box component="span" sx={{ fontSize: '0.75rem', bgcolor: TOKENS.borderLight, borderRadius: '12px', px: 1, py: 0.25, textTransform: 'capitalize' }}>{q.difficulty}</Box>}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem', color: TOKENS.textSecondary }}>
          <CircularProgress size={11} thickness={5} sx={{ color: TOKENS.brand }} />{checking ? 'Checking the answer' : 'Written'}
        </Box>
      </Box>
      {q.prompt && <QuestionText text={q.prompt} />}
      {q.options && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
          {q.options.map((o, i) => <Box key={i} sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, bgcolor: TOKENS.bg, borderRadius: '8px', px: 1, py: 0.5 }}>{'ABCDEF'[i]}. {o}</Box>)}
        </Box>
      )}
    </Box>
  );
}
