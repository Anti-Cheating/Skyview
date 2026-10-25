import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Avatar, Box, Chip, CircularProgress, IconButton, Menu, MenuItem, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { MdChatBubble, MdChatBubbleOutline, MdExpandLess, MdExpandMore, MdKeyboardArrowDown, MdRefresh } from 'react-icons/md';
import dayjs from 'dayjs';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useAuth } from '../../contexts/AuthContext';
import { isCompanyManagerRole } from '../../config/constants';
import { Breadcrumb } from '../common/Breadcrumb';
import { ActionButton } from '../common/ActionButton';
import { Caption, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentResultDetail, RubricMark, TimelineItem } from '../../types/assessment.types';
import { QuestionText } from './QuestionText';
import { fmt, isKeyed } from './marks';
import { isChoice, keyedOptions, textKeys } from './QuestionDialogs';
import { IntegrityTag, createInterviewUrl, fullName, gradingTag, minutes, timeTaken } from './ResultsTab';
import { formatDuration } from './AssessmentsListPage';
import { AssignTakeHome } from './AssignTakeHome';
import { DELIVERABLE_LABEL } from './deliverables';

const LETTERS = 'ABCDEF';
const RED = '#B91C1C', RED_BG = '#FEF2F2', AMBER = '#B45309', AMBER_BAR = '#F59E0B', GREEN_BAR = '#22C55E';

type Q = AssessmentResultDetail['questions'][number];

/** A white section card with an optional title. */
function Card({ title, children, sx }: { title?: ReactNode; children: ReactNode; sx?: object }) {
  return (
    <Box component="section" sx={{ bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '16px', p: { xs: 2, md: 3 }, minWidth: 0, ...sx }}>
      {title && <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1.75 }}>{title}</Typography>}
      {children}
    </Box>
  );
}

/** A card that opens on click; closed by default. */
/** When a section opens, scroll just enough to show all of it (top first if it's taller than the screen). */
function useRevealOnOpen(open: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [open]);
  return ref;
}

function Fold({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRevealOnOpen(open);
  return (
    <Box component="section" ref={ref} sx={{ scrollMarginTop: 24, scrollMarginBottom: 96, bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '16px', px: { xs: 2, md: 3 }, py: 2 }}>
      <Box component="button" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, borderRadius: '8px', '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, minWidth: 0 }}>
          {title}{sub && <Box component="span" sx={{ fontWeight: 400, color: TOKENS.textSecondary, fontSize: '0.82rem' }}> · {sub}</Box>}
        </Typography>
        <Box component="span" sx={{ display: 'flex', fontSize: '1.25rem', color: TOKENS.textSecondary }}>{open ? <MdExpandLess /> : <MdExpandMore />}</Box>
      </Box>
      {open && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}

const band = (v: number) => (v >= 75 ? GREEN_BAR : v >= 50 ? AMBER_BAR : TOKENS.error);

/** The score as a ring: "27 / 36" marks with the % under it, or "75 of 100" for results graded before marks. */
function ScoreRing({ value, marks }: { value: number | null; marks?: { got: number; max: number } | null }) {
  const c = 2 * Math.PI * 52, v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const big = value == null ? '—' : marks ? `${fmt(marks.got)}/${fmt(marks.max)}` : String(Math.round(v));
  return (
    <Box component="svg" viewBox="0 0 132 132" role="img" aria-label={value == null ? 'No score yet' : marks ? `${fmt(marks.got)} of ${fmt(marks.max)} marks, ${Math.round(v)}%` : `Score ${Math.round(v)} out of 100`} sx={{ width: 120, height: 120, flexShrink: 0 }}>
      <circle cx="66" cy="66" r="52" fill="none" stroke={TOKENS.borderLight} strokeWidth="12" />
      {value != null && <circle cx="66" cy="66" r="52" fill="none" stroke={band(v)} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 66 66)" />}
      <text x="66" y="72" textAnchor="middle" fontSize={big.length > 5 ? 20 : big.length > 3 ? 24 : 30} fontWeight="700" fill={TOKENS.textPrimary}>{big}</text>
      {value != null && <text x="66" y="92" textAnchor="middle" fontSize="12" fill={TOKENS.textSecondary}>{marks ? `${Math.round(v)}%` : 'of 100'}</text>}
    </Box>
  );
}

/** One row of the marks breakdown: label, its counts as chips, and marks on the right. */
function BreakdownRow({ label, got, max, facts, note }: { label: string; got: number; max?: number; facts: Array<{ n: number; text: string; tone?: 'good' | 'bad' }>; note?: string }) {
  const tones = { good: { bg: '#ECFDF5', fg: '#047857' }, bad: { bg: '#FEF2F2', fg: '#B91C1C' }, none: { bg: TOKENS.borderLight, fg: TOKENS.textSecondary } };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, flexWrap: 'wrap', '& + &': { borderTop: `1px solid ${TOKENS.borderLight}` } }}>
      <Box sx={{ width: 150, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textPrimary }}>{label}</Typography>
        {note && <Typography sx={{ fontSize: '0.72rem', color: TOKENS.textMuted }}>{note}</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 200, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {facts.map((f) => {
          const t = f.n ? tones[f.tone ?? 'none'] : tones.none;
          return (
            <Box key={f.text} component="span" sx={{ px: 1.25, py: 0.4, borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, bgcolor: t.bg, color: t.fg, opacity: f.n ? 1 : 0.6 }}>
              {f.n} {f.text}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', color: got < 0 ? '#B91C1C' : TOKENS.textPrimary, whiteSpace: 'nowrap' }}>
        {got < 0 ? `−${fmt(-got)}` : fmt(got)}{max != null && <Box component="span" sx={{ color: TOKENS.textMuted, fontWeight: 500 }}> / {fmt(max)}</Box>}
      </Typography>
    </Box>
  );
}

function Bar({ label, right, pct, color }: { label: ReactNode; right: ReactNode; pct: number | null; color?: string }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, fontSize: '0.875rem', mb: 0.75 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{label}</Box>
        <Box sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{right}</Box>
      </Box>
      <Box sx={{ height: 8, borderRadius: 999, bgcolor: TOKENS.borderLight, overflow: 'hidden' }}>
        {pct != null && <Box sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', bgcolor: color ?? band(pct) }} />}
      </Box>
    </Box>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <Box component="span" sx={{ color: TOKENS.textSecondary }}>{children}</Box>;

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem', lineHeight: 1.6, color: TOKENS.textPrimary }}>
      {items.map((x, i) => <li key={i}>{x}</li>)}
    </Box>
  );
}

const RECOMMENDATION_COLOR: Record<string, { bg: string; text: string }> = {
  'Strong Yes': { bg: '#ECFDF5', text: '#065F46' },
  'Yes': { bg: '#F0FDF4', text: '#166534' },
  'Needs Discussion': { bg: '#FFFBEB', text: '#92400E' },
  'No': { bg: RED_BG, text: '#991B1B' },
};

/** What a proven bug-hunt finding costs, as a share of its category (matches Cortex SEVERITY_DEDUCT). */
const SEVERITY_SHARE = { critical: 0.5, high: 0.25, medium: 0.1, low: 0 } as const;
const SEVERITY_COLOR = { critical: RED, high: '#C2410C', medium: AMBER, low: TOKENS.textSecondary } as const;

const KIND_LABEL: Record<string, string> = {
  happy: 'Normal use', unhappy: 'Bad input', edge: 'Edge case', abuse: 'Abuse attempt', real_world: 'Real-world',
};

/** "concurrency: [abuse] parallel_create_tampered_user_id" → { kind: "Abuse attempt", title: "parallel create tampered user id" } */
function prettyAttack(name: string): { kind?: string; title: string } {
  const m = /^[^:]*:\s*\[(\w+)\]\s*(.*)$/.exec(name);
  const kind = m ? KIND_LABEL[m[1]!] : undefined;
  const body = (m ? m[2]! : name.replace(/^[^:]*:\s*/, '')).replace(/[_-]+/g, ' ').trim();
  return { ...(kind ? { kind } : {}), title: body || name };
}

/** Turn a raw assertion error into a plain line; drop diff noise and jargon. */
function prettyError(err?: string): string | null {
  if (!err) return null;
  const e = err.trim();
  if (/fetch failed|ECONNREFUSED|socket hang up/i.test(e)) return "the app didn't respond";
  if (/did not come back healthy|never returned 200|didn't start/i.test(e)) return "the app didn't recover";
  if (/didn't report|timed out|crashed/i.test(e)) return "the attack timed out";
  // "duplicate note IDs detected 1 !== 20" → "duplicate note IDs detected (got 1, expected 20)"
  const cmp = /^(.*?)\s+(-?\d+)\s*!==\s*(-?\d+)\s*$/.exec(e);
  if (cmp) return `${cmp[1]!.trim()} (got ${cmp[2]}, expected ${cmp[3]})`;
  // Drop node:assert diff dumps ("+ actual - expected + '...' - '...' ^")
  const head = e.split(/\s*\+ actual| - expected|\n/)[0]!.trim();
  return head.length > 4 ? head.slice(0, 160) : e.slice(0, 160);
}

const codeLink = (repo: string, sha: string, e: { file: string; line: number }) => `${repo.replace(/\/$/, '')}/blob/${sha}/${e.file}#L${e.line}`;
const LINK_SX = { color: TOKENS.success, fontWeight: 600, fontFamily: 'monospace', textDecoration: 'none', mr: 1, '&:hover': { textDecoration: 'underline' } } as const;

/** One rubric line of a build task, in full: the explanation, then every check, finding and code line behind the mark. */
function MarkDetail({ m, repo, sha }: { m: RubricMark; repo: string | null; sha?: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 1.5, py: 1.5, borderTop: `1px solid ${TOKENS.borderLight}`, '&:first-of-type': { borderTop: 0, pt: 0 } }}>
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>{m.criterion.split(':')[0]}</Typography>
        {m.tests && (
          <Caption sx={{ fontWeight: 600, color: m.tests.passed === m.tests.total ? TOKENS.success : AMBER }}>
            {m.tests.passed === m.tests.total ? `Held up against all ${m.tests.total} checks` : `Broke on ${m.tests.total - m.tests.passed} of ${m.tests.total} checks`}
          </Caption>
        )}
        {(m.plain_explanation || m.reason) && <Typography sx={{ fontSize: '0.84rem', lineHeight: 1.5 }}>{m.plain_explanation || m.reason}</Typography>}
        {m.business_impact && <Caption sx={{ color: '#92400E' }}>Risk: {m.business_impact}</Caption>}
        {m.failed?.map((f, j) => {
          const a = prettyAttack(f.name); const why = prettyError(f.error);
          return (
            <Box key={j} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', fontSize: '0.84rem' }}>
              <Box component="span" sx={{ color: RED, fontWeight: 700 }} aria-hidden>✕</Box>
              <Box sx={{ minWidth: 0 }}>
                {a.kind && <Muted>{a.kind} · </Muted>}{a.title}
                {why && <Caption sx={{ display: 'block', color: TOKENS.textSecondary }}>{why}</Caption>}
              </Box>
            </Box>
          );
        })}
        {m.findings?.map((f, j) => (
          <Box key={j} sx={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}`, pl: 1, display: 'grid', gap: 0.25 }}>
            <Box sx={{ fontSize: '0.84rem' }}>
              <Box component="span" sx={{ fontWeight: 700, textTransform: 'capitalize', color: SEVERITY_COLOR[f.severity] }}>{f.severity}</Box> · <b>{f.title}</b>{' '}
              <Muted>{f.in_category ? (SEVERITY_SHARE[f.severity] ? `−${Math.round(SEVERITY_SHARE[f.severity] * m.points * 10) / 10} pts` : 'no deduction') : 'not scored here'}</Muted>
            </Box>
            <Caption sx={{ color: TOKENS.textSecondary }}>Breaks: “{f.violates}”{f.why ? ` · ${f.why}` : ''}</Caption>
            {!!f.evidence?.length && repo && sha && (
              <Caption>{f.evidence.map((e, k) => <Box key={k} component="a" href={codeLink(repo, sha, e)} target="_blank" rel="noopener noreferrer" sx={LINK_SX}>{e.file}:{e.line}</Box>)}</Caption>
            )}
            <Box component="details">
              <Box component="summary" sx={{ cursor: 'pointer', fontSize: '0.75rem', color: TOKENS.textSecondary }}>Proving attack</Box>
              <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, bgcolor: TOKENS.bg, borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}>{f.code}</Box>
            </Box>
          </Box>
        ))}
        {m.attack_bugs?.map((x, j) => <Caption key={j} sx={{ color: TOKENS.textSecondary }}>Not counted: {x.attack} (the check itself failed) · {x.error}</Caption>)}
        {m.set_aside?.map((x, j) => <Caption key={j} sx={{ color: TOKENS.textSecondary }}>Not counted: {x.attack} (needs {x.expected}, which the brief doesn’t ask for) · {x.why}</Caption>)}
        {!!m.evidence?.length && repo && sha && m.evidence.map((e, j) => (
          <Caption key={j} sx={{ color: TOKENS.textSecondary }}>
            <Box component="a" href={codeLink(repo, sha, e)} target="_blank" rel="noopener noreferrer" sx={LINK_SX}>{e.file}:{e.line}</Box>{e.note}
          </Caption>
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: m.not_scored ? TOKENS.textMuted : m.earned >= m.points ? TOKENS.success : m.earned > 0 ? AMBER : RED }}>
        {m.not_scored ? 'Not scored' : `${m.earned}/${m.points}`}
      </Typography>
    </Box>
  );
}

const marksOf = (q: Q) => q.rubric_marks ?? [];
const marksTotal = (q: Q) => marksOf(q).reduce((s, m) => (m.not_scored ? s : { got: s.got + m.earned, max: s.max + m.points }), { got: 0, max: 0 });

/** Answer marks a graded keyed question earned: its total minus the explanation marks. */
const answerPart = (q: Q) => (q.marks ?? 0) - marksTotal(q).got;

/** "+1", "−0.25", "2/3 + 2": what this answer earned, answer marks first. */
function marksText(q: Q): string | null {
  if (q.marks == null || !isKeyed(q)) return null;
  const a = answerPart(q), pts = q.points ?? 1, ex = marksTotal(q).got;
  const ans = a < 0 ? `−${fmt(-a)}` : q.format === 'multi' && a > 0 && a < pts ? `${fmt(a)}/${fmt(pts)}` : a > 0 ? `+${fmt(a)}` : '0';
  return ex > 0 ? `${ans} + ${fmt(ex)}` : ans;
}

/** One aptitude answer: a row that opens to show their answer next to the key. */
function AnswerRow({ q }: { q: Q }) {
  const [open, setOpen] = useState(false);
  const ref = useRevealOnOpen(open);
  const { got, max } = marksTotal(q);
  const text = typeof q.answer === 'string' ? q.answer : null;
  const blank = q.answer == null || q.answer === '' || (Array.isArray(q.answer) && !q.answer.length);
  const verdict = q.is_correct === true ? <Box component="span" sx={{ color: TOKENS.success }}>✓ Correct</Box>
    : q.is_correct === false ? <Box component="span" sx={{ color: RED }}>{blank ? 'Not answered' : '✕ Wrong'}</Box>
      : max ? <Box component="span" sx={{ color: got >= max ? TOKENS.success : got > 0 ? AMBER : RED }}>{got} / {max}</Box>
        : <Muted>—</Muted>;
  return (
    <Box ref={ref} sx={{ borderTop: `1px solid ${TOKENS.borderLight}`, '&:first-of-type': { borderTop: 0 }, scrollMarginTop: 24, scrollMarginBottom: 96 }}>
      <Box component="button" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.75, py: 1.75, px: 0.5, fontSize: '0.875rem', borderRadius: '8px', '&:hover': { bgcolor: TOKENS.bg }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
        <Box sx={{ width: 20, fontWeight: 700, color: TOKENS.textSecondary }}>{q.order}</Box>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: open ? 600 : 400 }}>{q.prompt}</Box>
        <Box sx={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{verdict}</Box>
        {marksText(q) && (
          <Box sx={{ minWidth: 48, textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: (q.marks ?? 0) < 0 ? RED : TOKENS.textPrimary }}>{marksText(q)}</Box>
        )}
        <Box sx={{ width: 56, textAlign: 'right', fontSize: '0.82rem', color: TOKENS.textSecondary, whiteSpace: 'nowrap' }}>{minutes(q.time_ms)}</Box>
        <Box component="span" sx={{ display: 'flex', color: TOKENS.textMuted }}>{open ? <MdExpandLess /> : <MdExpandMore />}</Box>
      </Box>
      {open && (
        <Box sx={{ pl: { xs: 0.5, sm: 4.5 }, pr: 0.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <QuestionText text={q.prompt} />
          {isChoice(q.format) && q.options ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
              {q.format === 'multi' && <Caption sx={{ gridColumn: '1 / -1', color: TOKENS.textSecondary }}>Multiple correct: they had to pick every correct option.</Caption>}
              {q.options.map((o, i) => {
                const key = keyedOptions(q).includes(i), picked = Array.isArray(q.answer) ? q.answer.includes(i) : i === q.answer;
                return (
                  <Box key={i} sx={{
                    display: 'flex', gap: 1, px: 1.25, py: 0.75, borderRadius: '8px', fontSize: '0.85rem',
                    bgcolor: key ? TOKENS.brandBg : picked ? RED_BG : TOKENS.bg, fontWeight: key || picked ? 600 : 400,
                    border: `1px solid ${picked ? (key ? TOKENS.brand : '#FCA5A5') : 'transparent'}`,
                  }}>
                    <Box component="span" sx={{ color: TOKENS.textSecondary, minWidth: 16 }}>{LETTERS[i]}</Box>
                    <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{o}</Box>
                    {picked && <Caption sx={{ color: key ? TOKENS.success : RED, fontWeight: 700 }}>Their pick</Caption>}
                    {key && !picked && <Caption sx={{ color: TOKENS.success, fontWeight: 700 }}>Answer</Caption>}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ bgcolor: TOKENS.bg, borderRadius: '10px', px: 1.5, py: 1 }}>
              <Caption sx={{ color: TOKENS.textSecondary, display: 'block' }}>Their answer</Caption>
              <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: text ? TOKENS.textPrimary : TOKENS.textMuted }}>{text || 'Not answered'}</Typography>
              {textKeys(q) && <Caption sx={{ color: TOKENS.textSecondary, display: 'block', mt: 0.5 }}>Answer: {textKeys(q)!.join(' · ')}{q.match_note === 'ai_match' ? ' · matched by AI' : ''}</Caption>}
            </Box>
          )}
          {q.format !== 'written' && marksOf(q).length > 0 && (
            <Box sx={{ bgcolor: TOKENS.bg, borderRadius: '10px', px: 1.5, py: 1 }}>
              <Caption sx={{ color: TOKENS.textSecondary, display: 'block' }}>Their explanation</Caption>
              <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: q.explanation ? TOKENS.textPrimary : TOKENS.textMuted }}>{q.explanation || 'Left blank'}</Typography>
            </Box>
          )}
          {marksOf(q).map((m, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, fontSize: '0.84rem' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <b>{m.criterion.split(':')[0]}</b>
                {m.reason && <Caption sx={{ display: 'block', color: TOKENS.textSecondary }}>{m.reason}</Caption>}
              </Box>
              <Box sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: m.earned >= m.points ? TOKENS.success : m.earned > 0 ? AMBER : RED }}>{m.earned}/{m.points}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** A header action: the icon says it, the tooltip names it. */
function IconAction({ title, onClick, disabled, busy, active, children }: { title: string; onClick: (e: React.MouseEvent<HTMLElement>) => void; disabled?: boolean; busy?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton aria-label={title} onClick={onClick} disabled={disabled || busy}
          sx={{ width: 44, height: 44, border: `1px solid ${active ? TOKENS.brand : TOKENS.border}`, borderRadius: '10px', bgcolor: active ? TOKENS.brandBg : '#fff', color: active ? TOKENS.success : TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary, bgcolor: TOKENS.bg } }}>
          {busy ? <CircularProgress size={18} sx={{ color: TOKENS.brand }} /> : children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/**
 * A note on this result, for the team to act on later. It never changes the
 * score or the integrity level.
 */
/**
 * The note on a result, as a speech bubble from the comment icon: who wrote it and
 * when, and the text. One note per result; saving replaces it and records you as the writer.
 */
function NoteBubble({ r, assessmentId, anchor, onClose, onSaved }: { r: AssessmentResultDetail; assessmentId: string; anchor: HTMLElement | null; onClose: () => void; onSaved: (d: AssessmentResultDetail) => void }) {
  const { showError, showSuccess } = useSnackbar();
  const [text, setText] = useState(r.note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== (r.note?.text ?? '');
  const save = async () => {
    setSaving(true);
    try {
      const res = await AssessmentService.setNote(assessmentId, r.id, text);
      if (res.data) { onSaved(res.data); showSuccess(text.trim() ? 'Note saved' : 'Note removed'); onClose(); }
    } catch (e: any) {
      showError(e?.message || 'Could not save the note');
    } finally {
      setSaving(false);
    }
  };
  const by = r.note?.by ?? null;
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={saving ? undefined : onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: {
        mt: 1.25, width: 340, borderRadius: '14px', overflow: 'visible', p: 2, boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        // The bubble's tail, pointing up at the comment icon.
        border: `1px solid ${TOKENS.border}`,
        '&::before': { content: '""', position: 'absolute', top: -8, right: 15, width: 14, height: 14, bgcolor: '#fff', transform: 'rotate(45deg)', borderLeft: `1px solid ${TOKENS.border}`, borderTop: `1px solid ${TOKENS.border}`, boxShadow: '-3px -3px 6px rgba(0,0,0,0.04)' },
      } } }}>
      {r.note && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Avatar sx={{ width: 26, height: 26, fontSize: '0.75rem', fontWeight: 700, bgcolor: TOKENS.sidebar, color: TOKENS.brand }}>{(by ?? '?').charAt(0).toUpperCase()}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: TOKENS.textPrimary, lineHeight: 1.2 }}>{by ?? 'Someone on your team'}</Typography>
            {r.note.at && <Typography sx={{ fontSize: '0.72rem', color: TOKENS.textMuted }}>{dayjs(r.note.at).format('D MMM, h:mm A')}</Typography>}
          </Box>
        </Box>
      )}
      <TextField
        id="result-note" fullWidth multiline minRows={3} maxRows={8} autoFocus placeholder="Write a note for your team…"
        value={text} onChange={(e) => setText(e.target.value)}
        inputProps={{ 'aria-label': 'Note on this result', maxLength: 4000 }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.9rem', bgcolor: TOKENS.bg } }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
        <Typography sx={{ flex: 1, fontSize: '0.72rem', color: TOKENS.textMuted }}>Only your team sees this.</Typography>
        <ActionButton variant="secondary" size="small" onClick={onClose} disabled={saving}>Cancel</ActionButton>
        <ActionButton size="small" onClick={save} loading={saving} disabled={!dirty}>Save</ActionButton>
      </Box>
    </Popover>
  );
}

const DOT: Record<TimelineItem['kind'], string> = {
  start: TOKENS.brand, submit: TOKENS.brand, answer: '#9CA3AF', app: RED, keyboard: AMBER, activity: AMBER, voice: '#2563EB', audio: '#2563EB',
  focus: '#7C3AED', closed: '#D1D5DB',
};
const KIND: Record<TimelineItem['kind'], string> = {
  start: 'Start', submit: 'Submit', answer: 'Answer', app: 'App', keyboard: 'Keyboard', activity: 'Activity', voice: 'Voice', audio: 'Computer audio',
  focus: 'Focus', closed: 'Closed',
};

/** Everything in order from Start, top to bottom, like the interview report's activity feed. */
function TimelineList({ items }: { items: TimelineItem[] }) {
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, position: 'relative', '&::before': { content: '""', position: 'absolute', left: 61, top: 6, bottom: 6, width: '2px', bgcolor: TOKENS.borderLight } }}>
      {items.map((t, i) => {
        const severe = /^(HIGH|CRITICAL)$/i.test(t.risk ?? '');
        return (
          <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: '48px 28px minmax(0,1fr)', alignItems: 'start', py: 0.5 }}>
            <Box sx={{ fontSize: '0.8rem', color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums', pt: '1px' }}>{mmss(t.t_ms)}</Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: '5px' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.kind === 'answer' ? (t.ok ? TOKENS.success : t.ok === false ? '#F87171' : '#9CA3AF') : DOT[t.kind], boxShadow: '0 0 0 3px #fff', zIndex: 1 }} />
            </Box>
            <Box sx={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'anywhere' }}>
              <Box component="span" sx={{ color: TOKENS.textSecondary, fontWeight: 600, mr: 0.75 }}>{KIND[t.kind]}</Box>
              <Box component="span" sx={{ color: severe ? RED : TOKENS.textPrimary, fontWeight: severe ? 600 : 400 }}>{t.text}</Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Caption sx={{ color: TOKENS.textSecondary, display: 'block' }}>{label}</Caption>
      <Box sx={{ fontSize: '0.875rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  );
}

/** /assessments/:id/results/:aid: one candidate's result, laid out like the interview post-analysis. */
export default function ResultDetailPage() {
  const { id = '', aid = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const [a, setA] = useState<Assessment | null>(null);
  const [r, setR] = useState<AssessmentResultDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [regrading, setRegrading] = useState(false);
  const [noteAnchor, setNoteAnchor] = useState<HTMLElement | null>(null);
  const [nextAnchor, setNextAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    Promise.all([AssessmentService.get(id), AssessmentService.result(id, aid)])
      .then(([x, y]) => { setA(x.data ?? null); setR(y.data ?? null); })
      .catch((e) => setErr(e?.message || 'Could not load this result'));
  }, [id, aid]);

  // Keep checking while grading is still running.
  useEffect(() => {
    if (!r || ((r.grading_status === 'done' || r.grading_status === 'failed') && r.integrity.report_status !== 'pending')) return;
    const t = setInterval(() => AssessmentService.result(id, aid).then((y) => y.data && setR(y.data)).catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [aid, id, r]);

  if (err) return <Box sx={{ p: 3 }}><Alert severity="error">{err}</Alert></Box>;
  if (!a || !r) return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;

  const assignment = a.mode === 'take_home';
  const name = fullName(r.candidate) || r.candidate.email;
  const initials = (fullName(r.candidate) || r.candidate.email).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const correct = r.questions.filter((q) => q.is_correct).length;
  const keyed = r.questions.filter((q) => q.is_correct != null).length;
  const totalMs = r.questions.reduce((s, q) => s + q.time_ms, 0);
  // Marks scoring (results graded before it have no marks: they keep the % bars).
  const keyedQs = r.questions.filter(isKeyed);
  const answerMarks = r.marks != null ? { got: keyedQs.reduce((s, q) => s + answerPart(q), 0), max: keyedQs.reduce((s, q) => s + (q.points ?? 1), 0) } : null;
  const explainMarks = r.marks != null ? r.questions.filter((q) => q.format !== 'build').reduce((s, q) => ({ got: s.got + marksTotal(q).got, max: s.max + (q.rubric ?? []).reduce((t, l) => t + l.points, 0) }), { got: 0, max: 0 }) : null;
  // Plain-words facts under the Breakdown bars: what was right, and why explanations scored what they did.
  const blankAns = (q: Q) => q.answer == null || q.answer === '' || (Array.isArray(q.answer) && q.answer.length === 0);
  const answerFacts = (() => {
    const right = keyedQs.filter((q) => q.is_correct).length;
    const blank = keyedQs.filter(blankAns).length;
    const pts = [...new Set(keyedQs.map((q) => q.points ?? 1))];
    return { right, wrong: keyedQs.length - right - blank, blank, each: pts.length === 1 ? pts[0]! : null };
  })();
  const explainFacts = (() => {
    const withGuide = r.questions.filter((q) => q.format !== 'build' && (q.rubric ?? []).length);
    let marked = 0, empty = 0, notCounted = 0;
    for (const q of withGuide) {
      const text = q.format === 'written' ? (typeof q.answer === 'string' ? q.answer : '') : q.explanation ?? '';
      if (isKeyed(q) && answerPart(q) <= 0) notCounted++;
      else if (!text.trim()) empty++;
      else marked++;
    }
    return { marked, empty, notCounted };
  })();
  const lostMarks = r.questions.reduce((s, q) => s + Math.max(0, -(q.marks ?? 0)), 0);
  const manager = isCompanyManagerRole(user?.role);
  const submitted = r.status === 'submitted';
  const graded = r.grading_status === 'done' || r.grading_status === 'failed';
  const it = r.integrity;
  const tasks = r.questions.filter((q) => q.format === 'build');
  const reviews = tasks.map((q) => q.review).filter((x): x is NonNullable<Q['review']> => !!x);
  const recommendation = reviews.find((x) => x.recommendation)?.recommendation;
  const repo = tasks.map((q) => (typeof q.answer === 'string' ? q.answer : null)).find(Boolean) ?? null;
  const files = tasks.flatMap((q) => q.deliverable_files ?? []);

  const regrade = async () => {
    setRegrading(true);
    try {
      const y = await AssessmentService.regrade(id, aid);
      if (y.data) setR(y.data);
      showSuccess('Graded again');
    } catch (e: any) {
      showError(e?.message || 'Could not grade again');
    } finally {
      setRegrading(false);
    }
  };


  const aptitudeSummary: ReactNode[] = [
    keyed ? `Got ${correct} of ${keyed} right` : null,
    r.reasoning != null ? `Explanations scored ${Math.round(r.reasoning)}%` : null,
    it.report_status === 'pending' ? 'Writing the Trueyy Helper report…'
      : r.report?.summary ?? (it.reasons.length ? it.reasons.map((x) => x.text).join(' · ') : null),
  ].filter(Boolean);

  return (
    <Box sx={{ width: '100%', p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: a.title, to: `/assessments/${a.id}?tab=candidates` }, { label: name }]} />

      {/* Who, and what they took */}
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Their Google photo when they signed in with Google, else initials. */}
          <Avatar src={r.candidate.avatar_url ?? undefined} alt="" imgProps={{ referrerPolicy: 'no-referrer' }}
            sx={{ width: 56, height: 56, bgcolor: TOKENS.sidebar, color: TOKENS.brand, fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>{initials}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.25 }}>{name}</Typography>
            {fullName(r.candidate) && <Secondary sx={{ color: TOKENS.textSecondary }}>{r.candidate.email}</Secondary>}
          </Box>
          {r.grading_status !== 'done' && gradingTag(r)}
          <IconAction title={r.note ? `Note by ${r.note.by ?? 'your team'}` : 'Add a note'} active={!!noteAnchor || !!r.note} onClick={(e) => setNoteAnchor(noteAnchor ? null : e.currentTarget)}>
            {r.note ? <MdChatBubble /> : <MdChatBubbleOutline />}
          </IconAction>
          {!assignment && <IconAction title="Grade again" onClick={regrade} busy={regrading} disabled={!submitted}><MdRefresh /></IconAction>}
          {submitted && assignment && manager && <ActionButton onClick={() => navigate(createInterviewUrl(a, r))}>Create interview</ActionButton>}
          {submitted && !assignment && (
            <>
              <ActionButton onClick={(e) => setNextAnchor(e.currentTarget)} endIcon={<MdKeyboardArrowDown />} aria-haspopup="menu">Next step</ActionButton>
              <Menu anchorEl={nextAnchor} open={!!nextAnchor} onClose={() => setNextAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ sx: { borderRadius: '12px', mt: 0.5, minWidth: 200 } }}>
                <AssignTakeHome variant="item" candidate={r.candidate} excludeId={a.id} onDone={() => setNextAnchor(null)} />
                {manager && <MenuItem onClick={() => navigate(createInterviewUrl(a, r))}>Create interview</MenuItem>}
              </Menu>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: { xs: 2.5, md: 4.5 }, flexWrap: 'wrap', borderTop: `1px solid ${TOKENS.borderLight}`, pt: 2 }}>
          <Meta label="Assessment">{a.title}</Meta>
          {assignment ? (
            <>
              <Meta label="Hand in">{DELIVERABLE_LABEL[a.deliverable_type ?? 'code']}</Meta>
              <Meta label="Submitted">
                {r.submitted_at
                  ? `${dayjs(r.submitted_at).format('D MMM')} · ${minutes(timeTaken(a.mode, { time_ms: totalMs, started_at: r.started_at, submitted_at: r.submitted_at }))} of ${formatDuration('take_home', a.duration_min)}`
                  : 'Not yet'}
              </Meta>
              {(repo || files.length > 0) && (
                <Meta label="Work">
                  {repo && /^https?:\/\//.test(repo)
                    ? <Box component="a" href={repo} target="_blank" rel="noopener noreferrer" sx={{ color: TOKENS.success }}>{repo.replace(/^https?:\/\//, '')}</Box>
                    : repo}
                  {files.map((f, i) => <Chip key={i} size="small" variant="outlined" label={f.name} sx={{ ml: repo || i ? 0.75 : 0, borderRadius: '6px' }} />)}
                </Meta>
              )}
            </>
          ) : (
            <>
              <Meta label="Date">{r.started_at ? dayjs(r.started_at).format('D MMM YYYY, h:mm A') : '—'}</Meta>
              <Meta label="Time taken">{minutes(totalMs)} of {formatDuration('live', a.duration_min)}</Meta>
              <Meta label="Trueyy Helper"><IntegrityTag it={it} /></Meta>
            </>
          )}
        </Box>
      </Card>

      {noteAnchor && <NoteBubble key={r.note?.at ?? 'none'} r={r} assessmentId={a.id} anchor={noteAnchor} onClose={() => setNoteAnchor(null)} onSaved={setR} />}

      {r.grading_status === 'failed' && (
        <Alert severity="warning" sx={{ borderRadius: '10px' }}>Grading didn't finish.{!assignment && ' Use Grade again to retry.'}</Alert>
      )}

      {/* Score and what it's made of */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.25 }}>
        <Card sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <ScoreRing value={r.final_score} marks={!assignment && r.marks != null && r.max_marks ? { got: r.marks, max: r.max_marks } : null} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1 }}>{assignment ? 'Overall score' : 'Overall summary'}</Typography>
            {r.final_score == null && <Secondary sx={{ color: TOKENS.textSecondary }}>{!submitted ? 'Still taking it' : r.grading_status === 'failed' ? 'Not graded' : 'Grading…'}</Secondary>}
            {recommendation && (
              <Box component="span" sx={{ display: 'inline-block', mt: 0.5, px: 1.5, py: 0.5, borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, bgcolor: RECOMMENDATION_COLOR[recommendation]?.bg, color: RECOMMENDATION_COLOR[recommendation]?.text }}>
                Recommend: {recommendation}
              </Box>
            )}
            {/* Aptitude: the summary sits right here, next to the score. */}
            {!assignment && aptitudeSummary.length > 0 && (
              <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${TOKENS.borderLight}`, fontSize: '0.85rem' }}><Bullets items={aptitudeSummary} /></Box>
            )}
          </Box>
        </Card>
        <Card title="Breakdown">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {assignment ? (
              tasks.flatMap((q) => marksOf(q).map((m, i) => (
                <Bar key={`${q.id}-${i}`}
                  label={<>{tasks.length > 1 && <Muted>Task {q.order} · </Muted>}{m.criterion.split(':')[0]}</>}
                  right={m.not_scored ? <Muted>Not scored</Muted> : `${m.earned}/${m.points}`}
                  pct={m.not_scored || !m.points ? null : (m.earned / m.points) * 100}
                  color={m.earned >= m.points ? GREEN_BAR : AMBER_BAR} />
              )))
            ) : (
              <>
                {answerMarks && explainMarks ? (
                  // A plain table: each row is where marks came from, with the counts behind it.
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {answerMarks.max > 0 && (
                      <BreakdownRow label="Answers" got={answerMarks.got} max={answerMarks.max}
                        facts={[
                          { n: answerFacts.right, text: 'right', tone: 'good' },
                          { n: answerFacts.wrong, text: 'wrong', tone: 'bad' },
                          { n: answerFacts.blank, text: 'blank' },
                        ]}
                        note={answerFacts.each != null ? `${fmt(answerFacts.each)} mark${answerFacts.each === 1 ? '' : 's'} per right answer` : undefined} />
                    )}
                    {explainMarks.max > 0 && (
                      <BreakdownRow label="Explanations" got={explainMarks.got} max={explainMarks.max}
                        facts={[
                          { n: explainFacts.marked, text: 'marked', tone: 'good' },
                          { n: explainFacts.empty, text: 'left blank' },
                          { n: explainFacts.notCounted, text: 'not counted (answer wrong)', tone: 'bad' },
                        ]}
                        note="Count only when the answer is right" />
                    )}
                    {lostMarks > 0 && (
                      <BreakdownRow label="Negative marking" got={-lostMarks} facts={[]} note="Lost on wrong answers" />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, pt: 1.5, mt: 0.5, borderTop: `1px solid ${TOKENS.border}` }}>
                      <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem' }}>Total</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.marks ?? 0)} / {fmt(r.max_marks ?? 0)} marks</Typography>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Bar label="Correct answers" right={r.accuracy == null ? '—' : `${Math.round(r.accuracy)}%`} pct={r.accuracy} />
                    <Bar label="Explanation" right={r.reasoning == null ? '—' : `${Math.round(r.reasoning)}%`} pct={r.reasoning} />
                    {/* Graded before marks: no per-question marks to explain the bars yet. */}
                    {submitted && <Caption sx={{ color: TOKENS.textSecondary, display: 'block' }}>Graded with the old % system. Press Grade again (↻ at the top) to see the full breakdown in marks.</Caption>}
                  </>
                )}
              </>
            )}
            {assignment && !tasks.some((q) => marksOf(q).length) && <Secondary sx={{ color: TOKENS.textSecondary }}>{graded ? 'No breakdown for this result.' : 'Shows once grading is done.'}</Secondary>}
          </Box>
        </Card>
      </Box>

      {assignment ? (
        <>
          <Card title="Summary">
            {reviews.length === 0 ? (
              <Secondary sx={{ color: TOKENS.textSecondary }}>{!submitted ? 'Not submitted yet.' : graded ? 'No written review for this result.' : 'The review is written during grading.'}</Secondary>
            ) : reviews.map((x, i) => (
              <Typography key={i} sx={{ fontSize: '0.875rem', lineHeight: 1.7, color: x.error ? RED : TOKENS.textPrimary, mt: i ? 1 : 0 }}>
                {x.error ? `The review couldn't run: ${x.error}` : x.summary}
              </Typography>
            ))}
          </Card>
          {reviews.some((x) => x.strengths?.length || x.concerns?.length) && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.25 }}>
              <Card title={<Box component="span" sx={{ color: '#065F46' }}>Good</Box>}><Bullets items={reviews.flatMap((x) => x.strengths ?? [])} /></Card>
              <Card title={<Box component="span" sx={{ color: '#92400E' }}>To check</Box>}><Bullets items={reviews.flatMap((x) => x.concerns ?? [])} /></Card>
            </Box>
          )}
          {reviews.some((x) => x.interview_questions?.length) && (
            <Card title="Ask in the interview">
              <Box component="ol" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem', lineHeight: 1.6 }}>
                {reviews.flatMap((x) => x.interview_questions ?? []).map((t, i) => <li key={i}>{t}</li>)}
              </Box>
            </Card>
          )}
          {tasks.some((q) => marksOf(q).length || q.review?.run) && (
            <Fold title="Technical details" sub={(() => {
              const runs = reviews.map((x) => x.run).filter(Boolean);
              return runs.length ? runs.map((x) => (x!.booted ? `${x!.passed} of ${x!.total} checks passed` : "didn't start")).join(' · ') : 'checks and code links';
            })()}>
              {tasks.map((q) => {
                const rv = q.review, url = typeof q.answer === 'string' ? q.answer : null;
                return (
                  <Box key={q.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1, '& + &': { mt: 3 } }}>
                    {tasks.length > 1 && <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Task {q.order}</Typography>}
                    {rv?.run && (
                      <Caption sx={{ fontWeight: 600, color: rv.run.booted ? TOKENS.textPrimary : RED }}>
                        {rv.run.booted ? `Ran it: ${rv.run.passed} of ${rv.run.total} checks passed` : `Didn't start: ${rv.run.error ?? 'docker compose up failed'}`}
                        {rv.sha && url && <> · commit <Box component="a" href={`${url.replace(/\/$/, '')}/tree/${rv.sha}`} target="_blank" rel="noopener noreferrer" sx={LINK_SX}>{rv.sha.slice(0, 7)}</Box></>}
                      </Caption>
                    )}
                    <Box>{marksOf(q).map((m, i) => <MarkDetail key={i} m={m} repo={url} sha={rv?.sha} />)}</Box>
                    {rv?.run?.logs && (
                      <Box component="details">
                        <Box component="summary" sx={{ cursor: 'pointer', fontSize: '0.75rem', color: TOKENS.textSecondary }}>Start-up logs</Box>
                        <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, bgcolor: TOKENS.bg, borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto' }}>{rv.run.logs}</Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Fold>
          )}
        </>
      ) : (
        <>
          {(!!r.report?.evidence.length || it.report_status === 'failed') && (
            <Fold title="Trueyy Helper report" sub={<IntegrityTag it={it} />}>
              {r.report?.evidence.map((e, i) => (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 1, fontSize: '0.85rem', py: 0.25 }}>
                  <Box sx={{ color: TOKENS.textSecondary, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{e.at}</Box>
                  <Box>{e.text}</Box>
                </Box>
              ))}
              {it.report_status === 'failed' && <Secondary sx={{ color: '#92400E' }}>The report couldn't be written; the level comes from the Helper's alerts. Grade again to retry.</Secondary>}
            </Fold>
          )}
          {/* Right under the Helper report: every event from Start, top to bottom. */}
          {r.timeline.length > 0 && <Fold title="Timeline" sub={`${r.timeline.length} events`}><TimelineList items={r.timeline} /></Fold>}
          <Card title="Answers" sx={{ pb: 1 }}>
            {r.questions.map((q) => <AnswerRow key={q.id} q={q} />)}
          </Card>
        </>
      )}
    </Box>
  );
}
