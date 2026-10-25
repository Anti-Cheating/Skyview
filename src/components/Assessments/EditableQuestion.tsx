import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Checkbox, CircularProgress, FormControlLabel, IconButton, InputBase, Menu, MenuItem, Popover, Radio, Select, Switch, Tooltip, Typography } from '@mui/material';
import { MdAdd, MdCheck, MdClose, MdExpandMore, MdMoreHoriz, MdWarningAmber } from 'react-icons/md';
import { TOKENS } from '../../theme';
import { QuestionText } from './QuestionText';
import type { AssessmentQuestion, DeliverableType, Difficulty, QuestionFormat, QuestionPatch, RubricLine } from '../../types/assessment.types';
import { FORMAT_LABEL, RubricEditor, isChoice, keyedOptions, textKeys } from './QuestionDialogs';
import { DELIVERABLES, DELIVERABLE_LABEL } from './deliverables';
import { flagText } from './QuestionCard';
import { fmt, isKeyed, marksLabel, rubricTotal } from './marks';

const LETTERS = 'ABCDEF';
const WARN_TEXT = '#92400E';
const WARN_BG = '#FEF3C7';
const EXPLAIN_LINE: RubricLine = { criterion: 'Says why the answer is right', points: 2 };
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/** A starting rubric for an assignment task, in plain words. Weights add to 100. */
export const BUILD_RUBRIC: RubricLine[] = [
  { criterion: 'Does what the brief asks: every requirement works', points: 60 },
  { criterion: 'Handles bad input and errors safely, without crashing', points: 35 },
  { criterion: 'Notes explain the choices made and what is left out', points: 5 },
];

/** A new question or task, ready to edit in place. */
export function blankQuestion(mode: 'live' | 'take_home', deliverable?: DeliverableType | null): QuestionPatch {
  return mode === 'take_home'
    ? { format: 'build', deliverable_type: deliverable ?? 'code', topic: 'Assignment', difficulty: 'medium', prompt: 'Describe the task: the scenario, what to build or deliver, and how it is handed in.', rubric: BUILD_RUBRIC }
    : { format: 'mcq', topic: 'General', difficulty: 'medium', prompt: 'New question', options: ['Option A', 'Option B'], answer_key: 0, rubric: null };
}

/** What the rest of the question must become when its type changes, so it stays valid. */
function convert(q: AssessmentQuestion, to: QuestionFormat): QuestionPatch {
  const keyed = keyedOptions(q);
  const keyText = keyed.length ? q.options?.[keyed[0]!] : textKeys(q)?.[0];
  const opts = isChoice(q.format) && q.options ? q.options : null;
  if (to === 'mcq') return opts ? { format: to, options: opts, answer_key: keyed[0] ?? 0 } : { format: to, options: [keyText || 'Option A', 'Option B'], answer_key: 0 };
  if (to === 'multi') {
    const options = opts && opts.length >= 3 ? opts : [...(opts ?? [keyText || 'Option A']), 'Option B', 'Option C'].slice(0, Math.max(3, opts?.length ?? 0));
    return { format: to, options, answer_key: keyed.length >= 2 ? keyed : [keyed[0] ?? 0, (keyed[0] ?? 0) === 0 ? 1 : 0].sort((x, y) => x - y) };
  }
  if (to === 'written') return { format: to, options: null, answer_key: null, rubric: q.rubric?.length ? q.rubric : [{ criterion: 'Gives a clear, correct answer', points: 3 }] };
  return { format: to, options: null, answer_key: [keyText || 'answer'] };
}

/** Text that looks like text until you click it; saves when you click away. */
export function InlineText({ value, onSave, multiline, placeholder, label, sx, autoFocus, onDone }: {
  value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; label: string; sx?: object; autoFocus?: boolean; onDone?: () => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { const t = v.trim(); if (t && t !== value) onSave(t); else setV(value); onDone?.(); };
  return (
    <InputBase
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { setV(value); (e.target as HTMLElement).blur(); }
        if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); (e.target as HTMLElement).blur(); }
      }}
      multiline={multiline}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputProps={{ 'aria-label': label }}
      sx={{
        width: '100%', fontSize: '0.875rem', color: TOKENS.textPrimary, px: 1, py: 0.5, mx: -1, borderRadius: '8px',
        border: '1px solid transparent', transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { bgcolor: TOKENS.bg }, '&.Mui-focused': { borderColor: TOKENS.brand, bgcolor: '#fff' },
        ...sx,
      }}
    />
  );
}

/**
 * Question / brief text: shown formatted (headings, bold, code, tables); click to edit
 * the raw text, and it's formatted again once you click away.
 */
export function FormattedEditable({ value, onSave, placeholder, label, disabled, sx }: {
  value: string; onSave: (v: string) => void; placeholder?: string; label: string; disabled?: boolean; sx?: object;
}) {
  const [editing, setEditing] = useState(!value);
  if (editing && !disabled) {
    return <InlineText label={label} multiline autoFocus={!!value} value={value} onSave={onSave} placeholder={placeholder} sx={sx} onDone={() => value && setEditing(false)} />;
  }
  return (
    <Box role="button" tabIndex={disabled ? -1 : 0} aria-label={`Edit: ${label}`} onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditing(true); } }}
      sx={{ cursor: disabled ? 'default' : 'text', px: 1, py: 0.5, mx: -1, borderRadius: '8px', border: '1px solid transparent', '&:hover': disabled ? {} : { bgcolor: TOKENS.bg }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
      <QuestionText text={value} />
    </Box>
  );
}

/** Cursor-style review on a card's top edge: what the AI did, then Reject / Accept. */
export function AiReviewBar({ label, onAccept, onReject, disabled, rejectLabel = 'Reject', floating }: { label: string; onAccept: () => void; onReject: () => void; disabled?: boolean; rejectLabel?: string; floating?: boolean }) {
  // Cursor-style: ✕ Reject | ✓ Accept.
  const btn = { all: 'unset', cursor: 'pointer', height: 24, px: 0.75, display: 'inline-flex', alignItems: 'center', gap: 0.4, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, '& svg': { fontSize: '1rem' }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` }, '&[disabled]': { opacity: 0.5, cursor: 'default' } } as const;
  return (
    <Box role="group" aria-label={label} sx={{
      // floating: sits at the card's bottom-right and stays on screen while you scroll through a long card.
      ...(floating ? { position: 'sticky', bottom: 16, alignSelf: 'flex-end', mt: 0.5, zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' } : { position: 'absolute', top: -14, right: 16, zIndex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }),
      display: 'flex', alignItems: 'center', gap: 0.25, px: 0.25, py: 0.25, borderRadius: '8px', bgcolor: '#fff', border: `1px solid ${TOKENS.brand}` }}>
      <Box component="button" type="button" onClick={onReject} disabled={disabled} sx={{ ...btn, color: '#B91C1C', '&:hover': { bgcolor: '#FEF2F2' } }}><MdClose aria-hidden />{rejectLabel}</Box>
      <Box component="span" aria-hidden sx={{ width: '1px', height: 14, bgcolor: TOKENS.border }} />
      <Box component="button" type="button" onClick={onAccept} disabled={disabled} sx={{ ...btn, color: TOKENS.success, '&:hover': { bgcolor: TOKENS.brandBg } }}><MdCheck aria-hidden />Accept</Box>
    </Box>
  );
}

/**
 * "Marks [1] + 2": the answer marks (typed) plus the explanation marks from the
 * rubric. A written question has no right answer, so it shows its rubric total.
 */
/** A tiny number box that saves on blur / Enter; bad input snaps back. */
function NumBox({ value, label, disabled, onSave, width = 36 }: { value: number; label: string; disabled?: boolean; onSave: (n: number) => void; width?: number }) {
  const [v, setV] = useState(fmt(value));
  useEffect(() => setV(fmt(value)), [value]);
  const commit = () => {
    const n = Number(v);
    if (v.trim() === '' || !(n >= 0 && n <= 100)) return setV(fmt(value));
    if (n !== value) onSave(Math.round(n * 100) / 100);
  };
  return (
    <InputBase value={v} disabled={disabled} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      inputProps={{ inputMode: 'decimal', 'aria-label': label }}
      sx={{ width, fontSize: '0.8rem', fontWeight: 700, color: TOKENS.textPrimary, border: `1px solid ${TOKENS.border}`, borderRadius: '6px', '& input': { textAlign: 'center', p: '2px 0' }, '&.Mui-focused': { borderColor: TOKENS.brand } }} />
  );
}

/** "Marks [1] + 2" and, on single/multiple-correct questions, "−[0.25]" for a wrong answer. */
/** One legend entry: a coloured dot, a word, its marks. */
const Legend = ({ color, label, value }: { color: string; label: string; value: string }) => (
  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, '.stacked &': { width: '100%' } }}>
    <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
    <Box component="span" sx={{ flex: 1 }}>{label}</Box>
    <Box component="span" sx={{ fontWeight: 700, color: TOKENS.textPrimary, pl: 1 }}>{value}</Box>
  </Box>
);

function MarksControl({ q, disabled, onSave, inline }: { q: AssessmentQuestion; disabled?: boolean; onSave: (patch: { points?: number; negative_marks?: number }) => void; inline?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const extra = rubricTotal(q);
  const keyed = isKeyed(q);
  const choice = q.format === 'mcq' || q.format === 'multi';
  const total = (keyed ? q.points ?? 1 : 0) + extra;
  const minus = choice ? q.negative_marks ?? 0 : 0;
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 36, fontSize: '0.85rem', color: TOKENS.textPrimary } as const;
  return (
    <>
      {/* At a glance: "3 marks", plus the minus when there is one. Click to change. */}
      <Box component="button" type="button" disabled={disabled || !keyed} onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Marks for question ${q.order}: ${fmt(total)}${minus ? `, minus ${fmt(minus)} if wrong` : ''}. Change`}
        sx={{
          all: 'unset', cursor: keyed && !disabled ? 'pointer' : 'default', display: 'inline-flex', whiteSpace: 'nowrap', fontSize: '0.76rem', fontWeight: 500, color: TOKENS.textSecondary,
          ...(inline
            ? { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 0.5, px: 1.25, py: 0.75, borderRadius: '10px', bgcolor: TOKENS.bg, border: `1px solid ${TOKENS.borderLight}` }
            : { flexDirection: 'column', alignItems: 'flex-start', gap: 0.4, px: 1.25, py: 0.75, borderRadius: '10px', bgcolor: TOKENS.bg, border: `1px solid ${TOKENS.borderLight}`, minWidth: 104 }),
          ...(keyed && !disabled && { '&:hover': { bgcolor: TOKENS.border } }), '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` },
        }}>
        {/* A legend: what each part is worth. Wrong only shows when it costs something. */}
        {keyed && <Legend color={TOKENS.success} label="Correct" value={fmt(q.points ?? 1)} />}
        {extra > 0 && <Legend color="#3B82F6" label="Explanation" value={fmt(extra)} />}
        {minus > 0 && <Legend color="#DC2626" label="Wrong" value={`−${fmt(minus)}`} />}
      </Box>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { mt: 0.75, borderRadius: '12px', p: 1.5, width: 240 } }}>
        <Box sx={row}>Right answer<NumBox value={q.points ?? 1} label={`Marks for the right answer to question ${q.order}`} disabled={disabled} onSave={(points) => onSave({ points })} /></Box>
        {extra > 0 && <Box sx={row}>Explanation<Box component="span" sx={{ fontWeight: 600, pr: 1 }}>{fmt(extra)}</Box></Box>}
        {choice && (
          <Box sx={row}>Wrong answer
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: minus > 0 ? '#B91C1C' : TOKENS.textMuted }}>
              −<NumBox value={minus} label={`Marks lost for a wrong answer to question ${q.order}`} disabled={disabled} width={44} onSave={(negative_marks) => onSave({ negative_marks })} />
            </Box>
          </Box>
        )}
        <Box sx={{ ...row, mt: 0.5, pt: 1, borderTop: `1px solid ${TOKENS.borderLight}`, fontWeight: 700 }}>Total<span style={{ paddingRight: 8 }}>{marksLabel(total)}</span></Box>
      </Popover>
    </>
  );
}

/** A small select that looks like a chip. */
export function ChipSelect<T extends string>({ value, options, label, render, onChange, disabled }: {
  value: T; options: T[]; label: string; render: (v: T) => ReactNode; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <Select
      size="small" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} renderValue={(v) => render(v as T)}
      inputProps={{ 'aria-label': label }}
      sx={{
        height: 24, fontSize: '0.78rem', fontWeight: 600, borderRadius: '999px', bgcolor: TOKENS.borderLight, color: TOKENS.textPrimary,
        '& .MuiOutlinedInput-notchedOutline': { border: 0 }, '& .MuiSelect-select': { py: 0, pl: 1.25, pr: '26px !important', display: 'flex', alignItems: 'center', gap: 0.5 },
        '&:hover': { bgcolor: TOKENS.border },
      }}>
      {options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: '0.85rem' }}>{render(o)}</MenuItem>)}
    </Select>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The quiet line under a question: its type, level and topic. */
export function metaLine(q: AssessmentQuestion): string {
  return q.format === 'build'
    ? `${DELIVERABLE_LABEL[q.deliverable_type ?? 'code']} · ${cap(q.difficulty)}`
    : `${FORMAT_LABEL[q.format]} · ${cap(q.difficulty)} · ${q.topic}`;
}

/** The rubric's title: "Explanation marks · 2" (aptitude) or "Evaluation metrics · 5" (assignment). */
export const rubricTitle = (q: AssessmentQuestion) =>
  q.format === 'build' ? ['Evaluation metrics', `${q.rubric?.length ?? 0}`] : ['How the explanation is measured', marksLabel((q.rubric ?? []).reduce((s, l) => s + l.points, 0))];

/**
 * The rubric folds out of a bar along the card's bottom edge. `pad` is the card's
 * own padding, so the bar can run edge to edge.
 */
export function RubricBar({ q, open, onToggle, pad, children }: { q: AssessmentQuestion; open: boolean; onToggle: () => void; pad: string; children: ReactNode }) {
  const [title, count] = rubricTitle(q);
  return (
    <Box sx={{ mx: `-${pad}`, mb: `-${pad}`, borderTop: `1px solid ${TOKENS.borderLight}`, bgcolor: TOKENS.bg, borderBottomLeftRadius: '13px', borderBottomRightRadius: '13px' }}>
      <Box component="button" type="button" onClick={onToggle} aria-expanded={open}
        sx={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', gap: 1, px: pad, py: 1.1, borderRadius: open ? 0 : '0 0 13px 13px', '&:hover': { bgcolor: TOKENS.borderLight }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: -2 } }}>
        <Typography component="span" sx={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: TOKENS.textPrimary }}>
          {title}<Box component="span" sx={{ color: TOKENS.textMuted, fontWeight: 500 }}> · {count}</Box>
        </Typography>
        <Box component="span" aria-hidden sx={{ display: 'flex', fontSize: '1.2rem', color: TOKENS.textSecondary, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><MdExpandMore /></Box>
      </Box>
      {open && <Box sx={{ px: pad, pb: 1.75 }}>{children}</Box>}
    </Box>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 32 }}>
    <Typography sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, width: 52, flexShrink: 0 }}>{label}</Typography>
    {children}
  </Box>
);

/**
 * A question (or assignment task) edited right in the paper: click any part
 * and type; it saves when you click away. Type, level and topic sit in the
 * grey line below; every other action is in the ⋯ menu.
 */
export function EditableQuestion({ q, single, busy, disabled, ai = true, aiMark, onAcceptAi, onRejectAi, onPatch, onAskAi, onRegenerate, onDelete, onAcceptKey }: {
  q: AssessmentQuestion;
  single?: boolean;
  busy: boolean;
  disabled: boolean;
  onPatch: (patch: QuestionPatch) => Promise<boolean>;
  /** Off: no AI actions in the menu. */
  ai?: boolean;
  /** The AI just added or changed this question: outlined, with its own Accept / Reject. */
  aiMark?: 'added' | 'changed';
  onAcceptAi?: () => void;
  onRejectAi?: () => void;
  onAskAi: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onAcceptKey: () => void;
}) {
  const build = q.format === 'build';
  const hasRubric = !!q.rubric?.length;
  const flagged = q.check_status === 'flagged';
  const [open, setOpen] = useState(false);
  const metaRef = useRef<HTMLButtonElement | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const pick = (fn: () => void) => () => { setMenu(null); fn(); };

  // Rubric: edited locally, saved shortly after the last change once it's valid.
  const [rubric, setRubric] = useState<RubricLine[]>(q.rubric ?? []);
  useEffect(() => setRubric(q.rubric ?? []), [q.rubric]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clean = rubric.map((l) => ({ ...l, criterion: l.criterion.trim() })).filter((l) => l.criterion);
  const total = clean.reduce((t, l) => t + l.points, 0);
  const rubricOk = clean.length > 0 && (!build || total === 100);
  const changeRubric = (next: RubricLine[]) => {
    setRubric(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const c = next.map((l) => ({ ...l, criterion: l.criterion.trim() })).filter((l) => l.criterion);
      const ok = c.length > 0 && (!build || c.reduce((t, l) => t + l.points, 0) === 100);
      if (ok && JSON.stringify(c) !== JSON.stringify(q.rubric ?? [])) void onPatch({ rubric: c });
    }, 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const multi = q.format === 'multi';
  const keyed = keyedOptions(q);
  const minOptions = multi ? 3 : 2;
  /** New options; for mcq the key clamps into range, for multi the caller passes the remapped keys. */
  const setOptions = (options: string[], answer_key: number | number[] = multi ? keyed : (q.answer_key as number)) =>
    onPatch({ options, answer_key: Array.isArray(answer_key) ? answer_key : Math.min(answer_key, options.length - 1) });
  /** multi: tick / untick a correct option; at least two must stay ticked. */
  const toggleKey = (i: number) => {
    const next = keyed.includes(i) ? keyed.filter((k) => k !== i) : [...keyed, i].sort((x, y) => x - y);
    if (next.length >= 2) void onPatch({ answer_key: next });
  };
  const removeOption = (i: number) => multi
    ? setOptions(q.options!.filter((_, j) => j !== i), keyed.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)))
    : setOptions(q.options!.filter((_, j) => j !== i), (q.answer_key as number) > i ? (q.answer_key as number) - 1 : (q.answer_key as number) === i ? 0 : (q.answer_key as number));

  return (
    <Box sx={{ position: 'relative', flexShrink: 0, border: aiMark ? `2px solid ${TOKENS.brand}` : `1px solid ${flagged ? '#F59E0B' : TOKENS.border}`, borderRadius: '14px', bgcolor: aiMark === 'added' ? '#F0FDF4' : '#fff', opacity: busy ? 0.6 : 1, p: aiMark ? '19px' : 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, containerType: 'inline-size' }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {!single && <Typography sx={{ fontWeight: 700, color: TOKENS.textSecondary, pt: 0.6, minWidth: 16 }}>{q.order}</Typography>}
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          {/* Type · level · topic sits above the question; click to change. */}
          {!build && <Box component="button" type="button" ref={metaRef} onClick={() => setMetaOpen(true)} disabled={disabled} aria-label={`Change type, level and topic: ${metaLine(q)}`}
            sx={{ all: 'unset', cursor: 'pointer', display: 'inline-block', mb: 0.25, fontSize: '0.75rem', fontWeight: 600, color: TOKENS.textSecondary, borderRadius: '6px', px: 0.5, mx: -0.5, '&:hover': { color: TOKENS.textPrimary, bgcolor: TOKENS.bg }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
            {metaLine(q)}
          </Box>}
          <FormattedEditable label={build ? 'Brief' : 'Question'} disabled={disabled} value={q.prompt} onSave={(prompt) => void onPatch({ prompt })}
            placeholder={build ? 'The scenario, what to build or deliver, and how it is handed in' : 'Write the question'}
            sx={{ fontSize: '0.95rem', lineHeight: 1.6 }} />
        </Box>
        {busy && <CircularProgress size={16} sx={{ color: TOKENS.brand, mt: 1 }} />}
        {/* Marks legend top-right, like on an exam paper; on a narrow card it drops under the question. */}
        {!build && (
          <Box className="stacked" sx={{ flexShrink: 0, ['@container (max-width: 520px)']: { display: 'none' } }}>
            <MarksControl q={q} disabled={disabled} onSave={(patch) => void onPatch(patch)} />
          </Box>
        )}
        <Box sx={{ flexShrink: 0, mt: -0.5, mr: -1 }}>
          <IconButton aria-label={`More for question ${q.order}`} onClick={(e) => setMenu(e.currentTarget)} disabled={disabled} sx={{ color: TOKENS.textSecondary, borderRadius: '8px' }}>
            <MdMoreHoriz />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ pl: single ? 0 : 3.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {isChoice(q.format) && q.options && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, ['@container (max-width: 520px)']: { gridTemplateColumns: '1fr' } }}>
            {multi && <Typography sx={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: TOKENS.textSecondary }}>Tick every correct option (at least 2).</Typography>}
            {q.options.map((o, i) => {
              const key = keyed.includes(i);
              const lastKeys = multi && key && keyed.length <= 2;
              return (
                <Box key={`${i}-${o}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.25, pr: 0.5, borderRadius: '10px', bgcolor: key ? TOKENS.brandBg : TOKENS.bg }}>
                  <Tooltip title={lastKeys ? 'At least two must be correct' : key ? 'Correct answer' : 'Mark as correct'}>
                    {multi
                      ? <Checkbox size="small" checked={key} disabled={disabled} onChange={() => toggleKey(i)} inputProps={{ 'aria-label': `Option ${LETTERS[i]} is correct` }} sx={{ p: 0.5 }} />
                      : <Radio size="small" checked={key} disabled={disabled} onChange={() => void onPatch({ answer_key: i })} inputProps={{ 'aria-label': `Option ${LETTERS[i]} is correct` }} sx={{ p: 0.5 }} />}
                  </Tooltip>
                  <InlineText label={`Option ${LETTERS[i]}`} value={o} onSave={(t) => void setOptions(q.options!.map((x, j) => (j === i ? t : x)))} sx={{ fontWeight: key ? 600 : 400, mx: 0 }} />
                  {q.options!.length > minOptions && !lastKeys && (
                    <IconButton size="small" aria-label={`Remove option ${LETTERS[i]}`} disabled={disabled} sx={{ color: TOKENS.textMuted }}
                      onClick={() => void removeOption(i)}>
                      <MdClose />
                    </IconButton>
                  )}
                </Box>
              );
            })}
            {q.options.length < 6 && (
              <Box>
                <Tooltip title="Add an option">
                  <span><IconButton size="small" aria-label="Add an option" disabled={disabled} onClick={() => void setOptions([...q.options!, `Option ${LETTERS[q.options!.length]}`])} sx={{ color: TOKENS.textSecondary }}><MdAdd /></IconButton></span>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}

        {textKeys(q) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.85rem', color: TOKENS.textSecondary, whiteSpace: 'nowrap' }}>Accepted answers</Typography>
            <InlineText label="Accepted answers, comma separated" value={textKeys(q)!.join(', ')}
              onSave={(t) => { const forms = t.split(',').map((x) => x.trim()).filter(Boolean); if (forms.length) void onPatch({ answer_key: forms }); }} />
          </Box>
        )}

        {flagged && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: WARN_BG, borderRadius: '8px', px: 1.25, py: 0.75 }}>
            <MdWarningAmber color={WARN_TEXT} aria-hidden />
            <Typography sx={{ fontSize: '0.8rem', color: WARN_TEXT, flex: 1, minWidth: 0 }}>{flagText(q)}. Change the answer, or keep ours from the ⋯ menu.</Typography>
          </Box>
        )}

        {/* Narrow card: the legend as one plain line under the options. */}
        {!build && (
          <Box sx={{ display: 'none', ['@container (max-width: 520px)']: { display: 'block' } }}>
            <MarksControl q={q} disabled={disabled} inline onSave={(patch) => void onPatch(patch)} />
          </Box>
        )}


      </Box>

      {aiMark && <AiReviewBar floating label={aiMark === 'added' ? 'AI added' : 'AI changed'} onAccept={() => onAcceptAi?.()} onReject={() => onRejectAi?.()} disabled={disabled} />}
      {hasRubric && (
        <RubricBar q={q} open={open} onToggle={() => setOpen((v) => !v)} pad={aiMark ? '19px' : '20px'}>
          <RubricEditor value={rubric} onChange={changeRubric} weights={build} disabled={disabled} />
          {!rubricOk && (
            <Typography sx={{ fontSize: '0.78rem', color: '#B91C1C', mt: 1 }}>
              {build ? `Weights add up to ${total}%. Make them 100% to save.` : 'Write at least one line to save.'}
            </Typography>
          )}
        </RubricBar>
      )}

      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: '12px', minWidth: 200 } } }}>
        {ai && <MenuItem onClick={pick(onAskAi)}>Change with AI</MenuItem>}
        {ai && <MenuItem onClick={pick(onRegenerate)}>Write a new one</MenuItem>}
        <MenuItem onClick={pick(() => setMetaOpen(true))}>Type, level, topic</MenuItem>
        {flagged && <MenuItem onClick={pick(onAcceptKey)}>Keep our answer key</MenuItem>}
        <MenuItem onClick={pick(onDelete)} sx={{ color: '#B91C1C' }}>Delete</MenuItem>
      </Menu>

      <Popover open={metaOpen} anchorEl={metaRef.current} onClose={() => setMetaOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: '12px', p: 2, width: 300, display: 'flex', flexDirection: 'column', gap: 1 } } }}>
        <Field label="Type">
          {build ? (
            <ChipSelect label="Deliverable" value={(q.deliverable_type ?? 'code') as DeliverableType} options={DELIVERABLES.map((d) => d.value)} disabled={disabled}
              render={(v) => DELIVERABLE_LABEL[v]} onChange={(v) => void onPatch({ deliverable_type: v })} />
          ) : (
            <ChipSelect label="Question type" value={q.format} options={(Object.keys(FORMAT_LABEL) as QuestionFormat[]).filter((f) => f !== 'build')} disabled={disabled}
              render={(v) => FORMAT_LABEL[v]} onChange={(v) => v !== q.format && void onPatch(convert(q, v))} />
          )}
        </Field>
        <Field label="Level">
          <ChipSelect label="Difficulty" value={q.difficulty} options={DIFFICULTIES} disabled={disabled} render={cap} onChange={(difficulty) => void onPatch({ difficulty })} />
        </Field>
        {!build && (
          <Field label="Topic">
            <InlineText label="Topic" value={q.topic} onSave={(topic) => void onPatch({ topic })} sx={{ fontSize: '0.85rem', mx: 0, border: `1px solid ${TOKENS.border}` }} />
          </Field>
        )}
        {!build && q.format !== 'written' && (
          <FormControlLabel sx={{ ml: 0, mt: 0.5 }}
            control={<Switch size="small" checked={hasRubric} disabled={disabled}
              onChange={() => { void onPatch({ rubric: hasRubric ? null : [EXPLAIN_LINE] }); if (!hasRubric) setOpen(true); }} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Ask them to explain</Typography>} />
        )}
      </Popover>
    </Box>
  );
}
