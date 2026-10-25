import { useEffect, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { MdCheck, MdCheckCircle, MdClose } from 'react-icons/md';
import { TOKENS } from '../../theme';
import type { AssessmentQuestion, QuestionPatch } from '../../types/assessment.types';
import { FORMAT_LABEL, keyedOptions, textKeys } from './QuestionDialogs';
import { marksWithMinus } from './marks';
import { AiReviewBar } from './EditableQuestion';
import { QuestionText } from './QuestionText';

const LETTERS = 'ABCDEF';

type Kind = 'same' | 'del' | 'add';

/** Line diff (LCS): unchanged items, removed ones, then the ones that replace them. */
export function diffItems<T>(a: T[], b: T[], key: (x: T) => string): Array<{ item: T; kind: Kind }> {
  const ka = a.map(key), kb = b.map(key);
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = ka[i] === kb[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: Array<{ item: T; kind: Kind }> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { out.push({ item: b[j]!, kind: 'same' }); i++; j++; }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push({ item: a[i++]!, kind: 'del' });
    else out.push({ item: b[j++]!, kind: 'add' });
  }
  while (i < n) out.push({ item: a[i++]!, kind: 'del' });
  while (j < m) out.push({ item: b[j++]!, kind: 'add' });
  return out;
}

/**
 * Group a diff into hunks: runs of unchanged items, and each stretch of changes
 * (what goes + what comes in). `rebuild(i, side)` gives the list with hunk i taken
 * from that side and every other hunk left as `others` has it, which is how one hunk
 * is kept (new "before") or undone (new "after") without touching the rest.
 */
function hunksOf<T>(a: T[], b: T[], key: (x: T) => string) {
  const parts: Array<{ same: T[] } | { del: T[]; add: T[] }> = [];
  for (const { item, kind } of diffItems(a, b, key)) {
    const last = parts[parts.length - 1];
    if (kind === 'same') { if (last && 'same' in last) last.same.push(item); else parts.push({ same: [item] }); }
    else {
      const h = last && 'del' in last ? last : (parts.push({ del: [], add: [] }), parts[parts.length - 1] as { del: T[]; add: T[] });
      (kind === 'del' ? h.del : h.add).push(item);
    }
  }
  const changes = parts.filter((p): p is { del: T[]; add: T[] } => 'del' in p);
  const rebuild = (target: { del: T[]; add: T[] }, take: 'del' | 'add', others: 'del' | 'add') =>
    parts.flatMap((p) => ('same' in p ? p.same : p === target ? p[take] : p[others]));
  return { parts, changes, rebuild };
}

const TONE = {
  del: { bg: '#FEF2F2', fg: '#991B1B', bar: '#F87171', sign: '−' },
  add: { bg: '#F0FDF4', fg: '#166534', bar: '#4ADE80', sign: '+' },
} as const;

/** A changed piece, rendered as usual but marked: red with "−" (going) or green with "+" (coming). */
function Mark({ kind, children }: { kind: 'del' | 'add'; children: ReactNode }) {
  const t = TONE[kind];
  return (
    <Box sx={{ position: 'relative', bgcolor: t.bg, borderLeft: `3px solid ${t.bar}`, borderRadius: '6px', pl: 3, pr: 1.25, py: 0.75 }}>
      <Box component="span" aria-label={kind === 'del' ? 'removed' : 'added'} sx={{ position: 'absolute', left: 8, top: 6, fontWeight: 700, color: t.fg, userSelect: 'none' }}>{t.sign}</Box>
      <Box sx={{ ...(kind === 'del' && { opacity: 0.75, textDecoration: 'line-through' }) }}>{children}</Box>
    </Box>
  );
}

/** One change with its own ✕ (undo just this) and ✓ (keep just this). */
function Hunk({ onKeep, onUndo, disabled, whole, children }: { onKeep: () => void; onUndo: () => void; disabled?: boolean; whole?: boolean; children: ReactNode }) {
  // A whole rewrite is one change: no per-piece buttons, only the card's Reject / Accept.
  if (whole) return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>{children}</Box>;
  const btn = { all: 'unset', cursor: 'pointer', width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: '6px', fontSize: '0.95rem', '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` }, '&[disabled]': { opacity: 0.5, cursor: 'default' } } as const;
  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.5, '&:hover .hunk-actions, &:focus-within .hunk-actions': { opacity: 1 } }}>
      {children}
      <Box className="hunk-actions" sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.25, p: 0.25, borderRadius: '8px', bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', opacity: 0.85, transition: 'opacity 0.15s' }}>
        <Box component="button" type="button" aria-label="Undo this change" title="Undo this change" onClick={onUndo} disabled={disabled} sx={{ ...btn, color: '#B91C1C', '&:hover': { bgcolor: '#FEF2F2' } }}><MdClose /></Box>
        <Box component="button" type="button" aria-label="Keep this change" title="Keep this change" onClick={onKeep} disabled={disabled} sx={{ ...btn, color: TOKENS.success, '&:hover': { bgcolor: TOKENS.brandBg } }}><MdCheck /></Box>
      </Box>
    </Box>
  );
}

const meta = (q: AssessmentQuestion) => `${FORMAT_LABEL[q.format]} · ${q.difficulty} · ${q.topic}`;
const small = (v: string) => <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: TOKENS.textSecondary }}>{v}</Typography>;
type Opt = { text: string; key: boolean };
const optsOf = (q: AssessmentQuestion): Opt[] => (q.options ?? []).map((o, i) => ({ text: o, key: keyedOptions(q).includes(i) }));
/** Options + answer key back from option rows. */
const optionPatch = (format: AssessmentQuestion['format'], rows: Opt[]): QuestionPatch => {
  const keys = rows.flatMap((r, i) => (r.key ? [i] : []));
  return { options: rows.map((r) => r.text), answer_key: format === 'multi' ? keys : keys[0] ?? 0 };
};

/**
 * An AI edit waiting for review, like a diff in Cursor or Claude Code but still rendered:
 * the question reads as usual and only what changed is marked (red − going, green + coming).
 * Each change has its own ✕ / ✓; the card's edge has ✕ Reject | ✓ Accept for all of it.
 * `onUndoPart` saves a patch that puts one piece back; `onKeepPart` moves the baseline
 * so that piece stops showing as a change. When nothing is left, the review closes.
 */
export function AiDiffCard({ before, after, single, onAccept, onReject, onUndoPart, onKeepPart, disabled }: {
  before: AssessmentQuestion; after: AssessmentQuestion; single?: boolean; disabled?: boolean;
  onAccept: () => void; onReject: () => void;
  onUndoPart: (patch: QuestionPatch) => void; onKeepPart: (nextBefore: AssessmentQuestion) => void;
}) {
  const lines = hunksOf(before.prompt.split('\n'), after.prompt.split('\n'), (l) => l.trim());
  const opts = hunksOf(optsOf(before), optsOf(after), (x) => `${x.text}|${x.key}`);
  const rubric = hunksOf(before.rubric ?? [], after.rubric ?? [], (l) => `${l.criterion}|${l.points}`);
  const metaChanged = meta(before) !== meta(after);
  const keysA = textKeys(before)?.join(' · ') ?? '', keysB = textKeys(after)?.join(' · ') ?? '';
  const marksChanged = after.format !== 'build' && marksWithMinus(before) !== marksWithMinus(after);
  // Nothing of the old text survived → it's a new question: accept or reject it as a whole.
  const whole = !lines.parts.some((p) => 'same' in p && p.same.some((l) => l.trim()));
  const pending = lines.changes.length + opts.changes.length + rubric.changes.length + (metaChanged ? 1 : 0) + (keysA !== keysB ? 1 : 0) + (marksChanged ? 1 : 0);

  // Every change decided one by one → the review is done.
  useEffect(() => { if (pending === 0) onAccept(); }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const keep = (patch: Partial<AssessmentQuestion>) => onKeepPart({ ...before, ...patch });
  const optionRow = (x: Opt, letter: string) => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: '0.875rem', fontWeight: x.key ? 600 : 400, color: TOKENS.textPrimary, pr: 6 }}>
      <Box component="span" sx={{ color: TOKENS.textSecondary, minWidth: 14 }}>{letter}</Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{x.text}</Box>
      {x.key && <Box component="span" sx={{ color: TOKENS.success, display: 'flex' }} aria-label="Correct answer"><MdCheckCircle /></Box>}
    </Box>
  );
  let letter = 0;
  const nextLetter = () => LETTERS[letter++] ?? '';

  return (
    <Box sx={{ position: 'relative', flexShrink: 0, border: `2px solid ${TOKENS.brand}`, borderRadius: '14px', bgcolor: '#fff', p: '19px', display: 'flex', flexDirection: 'column', opacity: disabled ? 0.7 : 1 }}>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
      {!single && <Typography sx={{ fontWeight: 700, color: TOKENS.textSecondary, minWidth: 16 }}>{after.order}</Typography>}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {metaChanged ? (
          <Hunk whole={whole} disabled={disabled} onKeep={() => keep({ format: after.format, difficulty: after.difficulty, topic: after.topic })}
            onUndo={() => onUndoPart({ format: before.format, difficulty: before.difficulty, topic: before.topic })}>
            <Mark kind="del">{small(meta(before))}</Mark><Mark kind="add">{small(meta(after))}</Mark>
          </Hunk>
        ) : small(meta(after))}

        {/* The text, line by line: unchanged lines as usual, each changed stretch with its own ✕ / ✓. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {lines.parts.map((p, i) => {
            if ('same' in p) { const t = p.same.join('\n'); return t.trim() ? <QuestionText key={i} text={t} /> : null; }
            const del = p.del.join('\n'), add = p.add.join('\n');
            return (
              <Hunk key={i} whole={whole} disabled={disabled}
                onKeep={() => keep({ prompt: lines.rebuild(p, 'add', 'del').join('\n') })}
                onUndo={() => onUndoPart({ prompt: lines.rebuild(p, 'del', 'add').join('\n') })}>
                {del.trim() && <Mark kind="del"><QuestionText text={del} /></Mark>}
                {add.trim() && <Mark kind="add"><QuestionText text={add} /></Mark>}
              </Hunk>
            );
          })}
        </Box>

        {opts.parts.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {opts.parts.map((p, i) => 'same' in p
              ? p.same.map((x, j) => <Box key={`${i}-${j}`} sx={{ px: 1.25, py: 0.75, borderRadius: '8px', bgcolor: x.key ? TOKENS.brandBg : TOKENS.bg, borderLeft: '3px solid transparent' }}>{optionRow(x, nextLetter())}</Box>)
              : (
                <Hunk key={i} whole={whole} disabled={disabled}
                  onKeep={() => keep({ options: opts.rebuild(p, 'add', 'del').map((x) => x.text), answer_key: optionPatch(before.format, opts.rebuild(p, 'add', 'del')).answer_key as AssessmentQuestion['answer_key'] })}
                  onUndo={() => onUndoPart(optionPatch(after.format, opts.rebuild(p, 'del', 'add')))}>
                  {p.del.map((x, j) => <Mark key={`d${j}`} kind="del">{optionRow(x, '')}</Mark>)}
                  {p.add.map((x, j) => <Mark key={`a${j}`} kind="add">{optionRow(x, nextLetter())}</Mark>)}
                </Hunk>
              ))}
          </Box>
        )}

        {keysA !== keysB && (
          <Hunk whole={whole} disabled={disabled} onKeep={() => keep({ answer_key: after.answer_key })} onUndo={() => onUndoPart({ answer_key: before.answer_key })}>
            {keysA && <Mark kind="del">{small(`Accepted answers: ${keysA}`)}</Mark>}
            {keysB && <Mark kind="add">{small(`Accepted answers: ${keysB}`)}</Mark>}
          </Hunk>
        )}

        {rubric.changes.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {small('How the explanation is measured')}
            {rubric.parts.map((p, i) => {
              const row = (l: { criterion: string; points: number }) => <Box sx={{ display: 'flex', gap: 1, fontSize: '0.82rem', color: TOKENS.textPrimary, pr: 6 }}><Box sx={{ flex: 1 }}>{l.criterion}</Box><Box component="span" sx={{ color: TOKENS.textSecondary }}>{l.points}</Box></Box>;
              if ('same' in p) return p.same.map((l, j) => <Box key={`${i}-${j}`} sx={{ px: 1.25, py: 0.5 }}>{row(l)}</Box>);
              return (
                <Hunk key={i} whole={whole} disabled={disabled}
                  onKeep={() => keep({ rubric: rubric.rebuild(p, 'add', 'del') })}
                  onUndo={() => onUndoPart({ rubric: rubric.rebuild(p, 'del', 'add') })}>
                  {p.del.map((l, j) => <Mark key={`d${j}`} kind="del">{row(l)}</Mark>)}
                  {p.add.map((l, j) => <Mark key={`a${j}`} kind="add">{row(l)}</Mark>)}
                </Hunk>
              );
            })}
          </Box>
        )}

        {after.format !== 'build' && (marksChanged ? (
          <Hunk whole={whole} disabled={disabled} onKeep={() => keep({ points: after.points, negative_marks: after.negative_marks })}
            onUndo={() => onUndoPart({ points: before.points, negative_marks: before.negative_marks })}>
            <Mark kind="del">{small(marksWithMinus(before))}</Mark><Mark kind="add">{small(marksWithMinus(after))}</Mark>
          </Hunk>
        ) : small(marksWithMinus(after)))}
      </Box>
      </Box>
      <AiReviewBar floating label="AI changed" onAccept={onAccept} onReject={onReject} disabled={disabled} />
    </Box>
  );
}
