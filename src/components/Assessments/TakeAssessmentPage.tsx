import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, IconButton, TextField } from '@mui/material';
import { MdAccessTime, MdArrowBack, MdAssignment, MdBlock, MdCheckCircle, MdErrorOutline, MdEventBusy, MdLockClock } from 'react-icons/md';
import dayjs from 'dayjs';
import { CandidateAssessmentService } from '../../services/candidateAssessment.service';
import { ActionButton } from '../common/ActionButton';
import { useConfirm } from '../common/useConfirm';
import { Caption, CardTitle, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { CandidateAttempt } from '../../types/assessment.types';
import { QuestionText } from './QuestionText';
import { BuildTaskAnswer } from './BuildTaskAnswer';
import { AssessmentHelperSteps, HelperBanner } from './AssessmentHelper';
import { useAuth } from '../../contexts/AuthContext';
import { STORAGE_KEYS } from '../../config/constants';

// Same chrome as the candidate interview join page (CandidateJoinPage).
const PAGE_BG = '#F9FAFB';
const LETTERS = 'ABCDEF';
const FORMAT_HINT = { mcq: 'Pick one answer', fill_blank: 'Fill in the blank', short_answer: 'Short answer', written: 'Written answer', build: 'Build task' } as const;
const when = (iso: string) => dayjs(iso).format('ddd D MMM, h:mm A');

type Answer = {
  answer: number | string | null;
  explanation: string;
  deliverable_files?: Array<{ name: string; url?: string; content?: string; size?: number; type?: string }>;
};
type Save = 'idle' | 'saving' | 'saved' | 'error';

function errorOf(e: any): { message: string; code?: string } {
  return { message: e?.data?.error || e?.message || 'Something went wrong. Please try again.', code: e?.data?.code };
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function untilText(ms: number): string {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}${m % 60 ? ` ${m % 60} min` : ''}`;
  return `${Math.floor(h / 24)} days`;
}

/** Header bar, as on the interview join page. `onBack` only for logged-in candidates. */
function Header({ title, company, right, onBack }: { title: string; company?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 3 }, py: 1.5, borderBottom: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard, position: 'sticky', top: 0, zIndex: 2 }}>
      {onBack && (
        <IconButton onClick={onBack} size="small" aria-label="Back to my assessments" sx={{ color: '#6B7280' }}>
          <MdArrowBack />
        </IconButton>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <CardTitle component="h1" sx={{ m: 0, fontWeight: 700, color: TOKENS.textPrimary }}>{title}</CardTitle>
        {company && <Secondary sx={{ color: TOKENS.textSecondary }}>Hosted by {company}</Secondary>}
      </Box>
      {right}
    </Box>
  );
}

/** Centered white card with an icon tile (CandidateJoinPage's SetupCard). */
function Card({ icon, title, subtitle, tone = 'brand', children }: {
  icon: ReactNode; title: string; subtitle?: ReactNode; tone?: 'brand' | 'muted' | 'error'; children?: ReactNode;
}) {
  const tile = tone === 'error' ? { bg: '#FEF2F2', fg: TOKENS.error } : tone === 'muted' ? { bg: TOKENS.borderLight, fg: TOKENS.textSecondary } : { bg: TOKENS.brandBg, fg: TOKENS.brand };
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: { xs: 3, md: 5 }, px: { xs: 2, md: 3 }, pb: 3 }}>
      <Box sx={{ width: 460, maxWidth: '100%', bgcolor: TOKENS.bgCard, borderRadius: '16px', border: `1px solid ${TOKENS.border}`, boxShadow: '0 4px 24px rgba(17, 24, 39, 0.06)', p: { xs: 3, md: 3.5 } }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '11px', mb: 1.75, bgcolor: tile.bg, color: tile.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {icon}
        </Box>
        <CardTitle component="h2" sx={{ m: 0, mb: 0.5, fontWeight: 700 }}>{title}</CardTitle>
        {subtitle && <Secondary sx={{ color: TOKENS.textSecondary, mb: children ? 2.5 : 0 }}>{subtitle}</Secondary>}
        {children}
      </Box>
    </Box>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderBottom: `1px solid ${TOKENS.borderLight}` }}>
      <Secondary sx={{ color: TOKENS.textSecondary }}>{label}</Secondary>
      <Secondary sx={{ color: TOKENS.textPrimary, fontWeight: 600, textAlign: 'right' }}>{value}</Secondary>
    </Box>
  );
}

/** The timed test: one question at a time, autosave, per-question time. */
function TestView({ base, data, offset, onDone }: { base: string; data: CandidateAttempt; offset: number; onDone: (d: CandidateAttempt) => void }) {
  const questions = data.questions ?? [];
  const live = data.assessment.mode === 'live';
  const { confirm, dialog } = useConfirm();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries((data.answers ?? []).map((a) => [a.question_id, { answer: a.answer, explanation: a.explanation ?? '' }])));
  const [save, setSave] = useState<Save>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, tick] = useState(0);

  // Time on each question: saved total + the current visit while the tab is visible.
  const timeMs = useRef<Record<string, number>>(Object.fromEntries((data.answers ?? []).map((a) => [a.question_id, a.time_ms])));
  const since = useRef<number | null>(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const current = questions[idx];

  const bank = useCallback(() => {
    if (current && since.current != null) {
      timeMs.current[current.id] = (timeMs.current[current.id] ?? 0) + (Date.now() - since.current);
      since.current = Date.now();
    }
  }, [current]);

  const push = useCallback(async (qid: string) => {
    clearTimeout(timers.current[qid]);
    if (qid === current?.id) bank();
    const a = answersRef.current[qid] ?? { answer: null, explanation: '' };
    setSave('saving');
    try {
      await CandidateAssessmentService.save(base, qid, a.answer, a.explanation || null, timeMs.current[qid] ?? 0, a.deliverable_files);
      setSave('saved');
      setSaveError(null);
    } catch (e) {
      const err = errorOf(e);
      setSave('error');
      setSaveError(err.message);
      if (err.code === 'submitted') CandidateAssessmentService.get(base).then((r) => r.data && onDone(r.data));
    }
  }, [bank, current?.id, onDone, base]);

  const change = (qid: string, patch: Partial<Answer>, debounce: number) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? { answer: null, explanation: '' }), ...patch } }));
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => push(qid), debounce);
  };

  const go = (next: number) => {
    if (!current || next === idx || next < 0 || next >= questions.length) return;
    push(current.id); // banks this visit's time and saves it
    since.current = Date.now();
    setIdx(next);
  };

  // Pause the per-question clock while the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) { bank(); since.current = null; }
      else since.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [bank]);

  const deadline = data.deadline_at ? Date.parse(data.deadline_at) : Infinity;
  const remaining = deadline - (Date.now() + offset);

  const finish = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    if (current) await push(current.id);
    try {
      const r = await CandidateAssessmentService.submit(base);
      if (r.data) onDone(r.data);
    } catch {
      const r = await CandidateAssessmentService.get(base).catch(() => null);
      if (r?.data) onDone(r.data);
      else setSubmitting(false);
    }
  }, [current, onDone, push, submitting, base]);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining <= 0 && !submitting) finish();
  }, [remaining, submitting, finish]);

  const answered = (qid: string) => {
    const a = answers[qid]?.answer;
    return a !== null && a !== undefined && a !== '';
  };
  const unanswered = questions.filter((q) => !answered(q.id)).length;

  const submit = async () => {
    const ok = await confirm({
      title: 'Submit your answers?',
      body: unanswered
        ? `${unanswered} of ${questions.length} question${questions.length === 1 ? ' is' : 's are'} still unanswered. You can't change anything after you submit.`
        : "You can't change anything after you submit.",
      confirmLabel: 'Submit',
      cancelLabel: 'Keep working',
    });
    if (ok) finish();
  };

  // Answers must be typed: no pasting or dropping text into any answer box.
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const noPaste = (field: string) => ({
    onPaste: (e: React.ClipboardEvent) => { e.preventDefault(); setPasteNote(field); setTimeout(() => setPasteNote((f) => (f === field ? null : f)), 3000); },
    onDrop: (e: React.DragEvent) => e.preventDefault(),
  });
  const pasteHint = (field: string) => (pasteNote === field ? 'Pasting is turned off. Please type your answer.' : undefined);

  const low = remaining <= 5 * 60_000, critical = remaining <= 60_000;
  const a = current ? answers[current.id] ?? { answer: null, explanation: '' } : null;
  const block = live ? (e: React.SyntheticEvent) => e.preventDefault() : undefined;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: PAGE_BG }}>
      <Header
        title={data.assessment.title}
        company={data.assessment.company}
        right={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box role="timer" aria-label="Time left" sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: '8px', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: '0.95rem',
              bgcolor: critical ? '#FEF2F2' : low ? '#FFFBEB' : TOKENS.brandBg, color: critical ? '#B91C1C' : low ? '#92400E' : '#047857',
            }}>
              <MdAccessTime /> {clock(remaining)}
            </Box>
            <ActionButton onClick={submit} loading={submitting}>Submit</ActionButton>
          </Box>
        }
      />

      <Box sx={{ flex: 1, width: '100%', maxWidth: 820, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Question navigator */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }} role="navigation" aria-label="Questions">
          {questions.map((q, i) => {
            const on = i === idx, done = answered(q.id);
            return (
              <Box key={q.id} component="button" type="button" onClick={() => go(i)} aria-current={on ? 'step' : undefined}
                aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
                sx={{
                  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 34, height: 34, borderRadius: '8px', textAlign: 'center', lineHeight: '32px',
                  fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  border: `1px solid ${on ? TOKENS.brand : done ? 'rgba(76, 217, 100, 0.45)' : TOKENS.border}`,
                  bgcolor: done ? TOKENS.brandBg : TOKENS.bgCard, color: done ? '#047857' : TOKENS.textPrimary,
                  boxShadow: on ? `0 0 0 2px ${TOKENS.brandBg}` : 'none',
                  '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                }}>
                {i + 1}
              </Box>
            );
          })}
        </Box>

        {current && a && (
          <Box sx={{ bgcolor: TOKENS.bgCard, borderRadius: '16px', border: `1px solid ${TOKENS.border}`, boxShadow: '0 4px 24px rgba(17, 24, 39, 0.06)', p: { xs: 2.5, md: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>Question {idx + 1} of {questions.length}</Caption>
              <Caption sx={{ color: TOKENS.textSecondary }}>{FORMAT_HINT[current.format]}</Caption>
            </Box>

            {/* Live: the question and its options can't be copied out. Answer boxes stay normal (typing, pasting). */}
            <Box onCopy={block} onCut={block} onContextMenu={block} sx={{ fontSize: '1rem', userSelect: live ? 'none' : 'auto' }}><QuestionText text={current.prompt} /></Box>

            {current.format === 'mcq' && current.options && (
              <Box role="radiogroup" aria-label="Options" onCopy={block} onCut={block} onContextMenu={block} sx={{ display: 'flex', flexDirection: 'column', gap: 1, userSelect: live ? 'none' : 'auto' }}>
                {current.options.map((o, i) => {
                  const on = a.answer === o.id;
                  return (
                    <Box key={o.id} component="button" type="button" role="radio" aria-checked={on} onClick={() => change(current.id, { answer: o.id }, 0)}
                      sx={{
                        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', gap: 1.5, alignItems: 'flex-start', px: 1.75, py: 1.25, borderRadius: '10px',
                        border: `1px solid ${on ? TOKENS.brand : TOKENS.border}`, bgcolor: on ? TOKENS.brandBg : TOKENS.bgCard,
                        fontSize: '0.925rem', color: TOKENS.textPrimary, fontWeight: on ? 600 : 400,
                        '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                      }}>
                      <Box component="span" sx={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                        bgcolor: on ? TOKENS.brand : TOKENS.borderLight, color: on ? '#fff' : TOKENS.textSecondary,
                      }}>{LETTERS[i]}</Box>
                      <Box component="span" sx={{ flex: 1, minWidth: 0, pt: '2px' }}>{o.text}</Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {(current.format === 'fill_blank' || current.format === 'short_answer') && (
              <TextField fullWidth placeholder="Your answer" value={(a.answer as string) ?? ''} onChange={(e) => change(current.id, { answer: e.target.value }, 800)}
                inputProps={{ 'aria-label': 'Your answer', ...noPaste('answer') }} helperText={pasteHint('answer')}
                FormHelperTextProps={{ sx: { color: '#92400E' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            )}

            {current.format === 'written' && (
              <TextField fullWidth multiline minRows={7} placeholder="Write your answer" value={(a.answer as string) ?? ''} onChange={(e) => change(current.id, { answer: e.target.value }, 800)}
                inputProps={{ 'aria-label': 'Your answer', ...noPaste('answer') }} helperText={pasteHint('answer')}
                FormHelperTextProps={{ sx: { color: '#92400E' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            )}

            {current.format === 'build' && (
              <BuildTaskAnswer
                starter={current.starter}
                deliverableType={current.deliverable_type}
                deliverableFiles={a.deliverable_files}
                value={(a.answer as string) ?? ''}
                onChange={(v) => change(current.id, { answer: v }, 800)}
                onFilesChange={(files) => change(current.id, { deliverable_files: files }, 500)}
                error={save === 'error' ? saveError : null}
              />
            )}

            {current.explain && (
              <Box>
                <Secondary sx={{ fontWeight: 600, color: TOKENS.textPrimary, mb: 0.75 }}>Explain your answer</Secondary>
                <TextField fullWidth multiline minRows={4} placeholder="Show how you got your answer" value={a.explanation}
                  onChange={(e) => change(current.id, { explanation: e.target.value }, 800)}
                  inputProps={{ 'aria-label': 'Explain your answer', ...noPaste('explanation') }} helperText={pasteHint('explanation')}
                  FormHelperTextProps={{ sx: { color: '#92400E' } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 0.5 }}>
              <ActionButton variant="secondary" onClick={() => go(idx - 1)} disabled={idx === 0}>Previous</ActionButton>
              <Caption sx={{ flex: 1, textAlign: 'center', color: save === 'error' ? TOKENS.error : TOKENS.textMuted }} aria-live="polite">
                {save === 'saving' ? 'Saving…' : save === 'saved' ? 'All answers saved' : save === 'error' ? "Couldn't save. Check your connection; we'll retry when you change an answer." : ''}
              </Caption>
              {idx < questions.length - 1
                ? <ActionButton onClick={() => go(idx + 1)}>Next</ActionButton>
                : <ActionButton onClick={submit} loading={submitting}>Review &amp; submit</ActionButton>}
            </Box>
          </Box>
        )}
      </Box>
      {dialog}
    </Box>
  );
}

/**
 * The candidate's assessment. /a/:token from the invite email, or
 * /my-assessments/:attemptId when they're logged in.
 */
export default function TakeAssessmentPage() {
  const { token, attemptId } = useParams();
  const navigate = useNavigate();
  const base = token ? `/a/${token}` : `/me/assessments/${attemptId}`;
  const onBack = attemptId ? () => navigate('/my-assessments') : undefined;
  const [data, setData] = useState<CandidateAttempt | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [offset, setOffset] = useState(0); // server clock − browser clock
  const [starting, setStarting] = useState(false);
  const [, tick] = useState(0);
  const { refreshAuth } = useAuth();

  const apply = useCallback((d: CandidateAttempt) => {
    setOffset(Date.parse(d.now) - Date.now());
    setData(d);
  }, []);

  const load = useCallback(() => CandidateAssessmentService.get(base)
    .then((r) => r.data && apply(r.data))
    .catch((e) => setError(errorOf(e))), [apply, base]);

  useEffect(() => { load(); }, [load]);

  // Live from the email link: the Trueyy Helper needs the candidate signed
  // in, so trade the link for a login and continue on /my-assessments.
  const exchanged = useRef(false);
  useEffect(() => {
    if (!token || !data?.helper || exchanged.current) return;
    exchanged.current = true;
    CandidateAssessmentService.exchange(token)
      .then(async (r) => {
        if (!r.data) throw new Error('Could not sign you in');
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, r.data.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, r.data.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(r.data.user));
        await refreshAuth();
        navigate(`/my-assessments/${r.data.attempt_id}`, { replace: true });
      })
      .catch((e) => { exchanged.current = false; setError(errorOf(e)); });
  }, [data?.helper, navigate, refreshAuth, token]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const r = await CandidateAssessmentService.start(base);
      if (r.data) apply(r.data);
    } catch (e) {
      setError(errorOf(e));
    } finally {
      setStarting(false);
    }
  };

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: PAGE_BG }}>
        <Header title={data?.assessment.title ?? 'Assessment'} company={data?.assessment.company} onBack={onBack} />
        <Card icon={<MdErrorOutline />} tone="error" title="We couldn't open this assessment" subtitle={error.message}>
          {data && <ActionButton variant="secondary" fullWidth onClick={() => { setError(null); load(); }}>Try again</ActionButton>}
        </Card>
      </Box>
    );
  }
  if (!data || (token && data.helper)) {
    return (
      <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: PAGE_BG }}>
        <CircularProgress sx={{ color: TOKENS.brand }} aria-label="Loading assessment" />
      </Box>
    );
  }
  if (data.status === 'started') {
    return (
      <>
        {data.helper && <HelperBanner ids={data.helper} />}
        <TestView base={base} data={data} offset={offset} onDone={apply} />
      </>
    );
  }

  const { assessment: a } = data;
  const live = a.mode === 'live';
  const t = Date.now() + offset;
  const shell = (card: ReactNode) => (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: PAGE_BG }}>
      <Header title={a.title} company={a.company} onBack={onBack} />
      {card}
    </Box>
  );

  if (data.status === 'submitted') {
    return shell(
      <Card icon={<MdCheckCircle />} title="Your answers are submitted"
        subtitle={`Thanks${data.candidate_name ? `, ${data.candidate_name}` : ''}. ${a.company} has your answers and will be in touch about next steps. You can close this page.`} />
    );
  }
  if (data.status === 'cancelled') {
    return shell(<Card icon={<MdBlock />} tone="muted" title="This assessment was cancelled" subtitle={`${a.company} cancelled it, so there's nothing to take. You don't need to do anything.`} />);
  }
  if (data.status === 'revoked') {
    return shell(<Card icon={<MdBlock />} tone="muted" title="This invite was withdrawn" subtitle={`This link no longer works. Contact ${a.company} if you think this is a mistake.`} />);
  }
  if (data.window_enforced && t > Date.parse(data.closes_at)) {
    return shell(<Card icon={<MdEventBusy />} tone="muted" title="This assessment has closed" subtitle={`It had to be ${live ? 'finished' : 'started'} by ${when(data.closes_at)}. Contact ${a.company} if you think this is a mistake.`} />);
  }
  if (data.window_enforced && t < Date.parse(data.opens_at)) {
    return shell(
      <Card icon={<MdLockClock />} title="This assessment hasn't opened yet"
        subtitle={`It opens ${when(data.opens_at)}, in about ${untilText(Date.parse(data.opens_at) - t)}. Keep this page open or come back from your email link.`}>
        <ActionButton variant="secondary" fullWidth onClick={load}>Check again</ActionButton>
      </Card>
    );
  }

  const welcome = (
    <Card icon={<MdAssignment />} title={`Hi${data.candidate_name ? ` ${data.candidate_name}` : ''}, ready when you are`}
      subtitle={`${a.company} has invited you to take ${a.title}.`}>
      <Box sx={{ mb: 2.5 }}>
        <Fact label="Time limit" value={`${a.duration_min >= 60 ? `${Math.floor(a.duration_min / 60)} h${a.duration_min % 60 ? ` ${a.duration_min % 60} min` : ''}` : `${a.duration_min} min`}`} />
        <Fact label="Questions" value={`${a.question_count}${a.explain_count ? ` · ${a.explain_count} ask you to explain` : ''}`} />
        <Fact label={live ? 'Must finish by' : 'Start by'} value={when(data.closes_at)} />
      </Box>
      <Box component="ul" sx={{ m: 0, mb: 2.5, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, color: TOKENS.textSecondary, fontSize: '0.85rem' }}>
        <li>The timer starts when you press Start and keeps running even if you close the page.</li>
        <li>Your answers save automatically as you go. You can move between questions freely.</li>
        <li>Type your answers yourself: pasting into answer boxes is turned off.</li>
        <li>When time runs out, your answers are submitted for you.</li>
        {live && <li>This is a live assessment: take it in one sitting, without other help.</li>}
        {data.helper && <li>The Trueyy Helper stays on until you submit. It watches for other apps, pasting and voices. It takes no screenshots.</li>}
      </Box>
      <ActionButton fullWidth onClick={start} loading={starting}>Start assessment</ActionButton>
    </Card>
  );
  if (!data.helper) return shell(welcome);
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: PAGE_BG }}>
      <Header title={a.title} company={a.company} onBack={onBack} />
      <AssessmentHelperSteps ids={data.helper} company={a.company}>{welcome}</AssessmentHelperSteps>
    </Box>
  );
}
