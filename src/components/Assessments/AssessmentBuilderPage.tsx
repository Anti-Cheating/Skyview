import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, CircularProgress, FormControlLabel, IconButton, Switch, Tooltip, Typography } from '@mui/material';
import { MdAdd, MdRemoveCircleOutline, MdAssignment, MdPersonAddAlt1, MdBalance, MdQuiz, MdSettings, MdTimer, MdVerifiedUser, MdWorkOutline } from 'react-icons/md';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../common/useConfirm';
import { Breadcrumb } from '../common/Breadcrumb';
import { ActionButton } from '../common/ActionButton';
import { PageTitle } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentQuestion, ChatEntry, QuestionPatch } from '../../types/assessment.types';
import { MODE_LABEL, STATUS_TAG, formatDuration } from './AssessmentsListPage';
import { QuestionCard } from './QuestionCard';
import { AiReviewBar, EditableQuestion, InlineText, blankQuestion } from './EditableQuestion';
import { AiEditDialog } from './QuestionDialogs';
import { DELIVERABLES } from './deliverables';
import { SettingsDialog } from './SettingsDialog';
import { ChatPanel } from './ChatPanel';
import { marksLabel, minusOf, paperMax } from './marks';
import { AiDiffCard } from './AiDiff';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarRight01Icon } from '@hugeicons/core-free-icons';
import { DraftCard, START_PROGRESS, foldProgress, type TurnProgress } from './ChatProgress';
import { CandidatesTab } from './CandidatesTab';
import { StatusTag } from '../common/StatusTag';

/** Builder: the paper in one column, edited in place, with the AI chat in a panel on the right. */
/**
 * AI edits waiting for review, Cursor-style: each touched question is outlined
 * with its own Accept / Reject. `before` holds the version to go back to.
 */
type AiChange = { before: Record<string, AssessmentQuestion>; marks: Record<string, 'added' | 'changed'>; removed: AssessmentQuestion[] };

/** Fold a new AI change into the ones still waiting (the oldest "before" wins). Null when nothing is waiting. */
function foldChange(prev: AiChange | null, before: AssessmentQuestion[], after: AssessmentQuestion[]): AiChange | null {
  const was = new Map(before.map((q) => [q.id, q]));
  const next: AiChange = { before: { ...(prev?.before ?? {}) }, marks: { ...(prev?.marks ?? {}) }, removed: [...(prev?.removed ?? [])] };
  for (const q of after) {
    if (!was.has(q.id)) next.marks[q.id] = 'added';
    else if (was.get(q.id)!.updated_at !== q.updated_at) {
      next.marks[q.id] ??= 'changed';
      next.before[q.id] ??= was.get(q.id)!;
    }
  }
  for (const q of before) {
    if (after.some((x) => x.id === q.id)) continue;
    if (next.marks[q.id] === 'added') { delete next.marks[q.id]; continue; } // it came from the AI too: nothing to restore
    next.removed.push(next.before[q.id] ?? q);
    delete next.marks[q.id];
  }
  return Object.keys(next.marks).length || next.removed.length ? next : null;
}

/** The editable fields of a question, to put it back the way it was. */
const restoreOf = (q: AssessmentQuestion): QuestionPatch => ({
  format: q.format, deliverable_type: q.deliverable_type, topic: q.topic, difficulty: q.difficulty,
  prompt: q.prompt, options: q.options, answer_key: q.answer_key, rubric: q.rubric,
});

const CHAT_MIN = 300, CHAT_MAX = 640;
const clampChat = (w: number) => Math.min(CHAT_MAX, Math.max(CHAT_MIN, Math.round(w)));

export default function AssessmentBuilderPage() {
  const { id = '' } = useParams();
  const { showError, showSuccess } = useSnackbar();
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [a, setA] = useState<Assessment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<ChatEntry | null>(null);
  const [progress, setProgress] = useState<TurnProgress | null>(null);
  /** 'chat' | 'finalize' | a question id while that action runs. */
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssessmentQuestion | null>(null);
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // AI help on or off, remembered per browser; off = write every question by hand.
  const [ai, setAiState] = useState(() => { try { return localStorage.getItem('trueyy.assessmentAi') !== 'off'; } catch { return true; } });
  const setAi = (on: boolean) => { setAiState(on); if (on) setChatOpen(true); try { localStorage.setItem('trueyy.assessmentAi', on ? 'on' : 'off'); } catch { /* private window: just this visit */ } };
  // The AI panel: hidden or shown (AI stays on either way), and its width, remembered per browser.
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(() => { try { return clampChat(Number(localStorage.getItem('trueyy.aiPanelWidth')) || 360); } catch { return 360; } });
  const resizeChat = (w: number) => { const v = clampChat(w); setChatWidth(v); try { localStorage.setItem('trueyy.aiPanelWidth', String(v)); } catch { /* not remembered */ } };
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = chatWidth;
    const move = (ev: PointerEvent) => resizeChat(w0 + (x0 - ev.clientX)); // the panel is on the right: dragging left widens it
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  // AI edits waiting for Accept / Reject, per question.
  const [review, setReview] = useState<AiChange | null>(null);
  // Tab lives in the URL (?tab=candidates) so Back from a result lands on the same tab.
  // Candidates holds the results too; old ?tab=results / ?tab=paper links still land right.
  type TabId = 'questions' | 'candidates';
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const urlTab: TabId | null = rawTab === 'candidates' || rawTab === 'results' ? 'candidates' : rawTab === 'questions' || rawTab === 'paper' ? 'questions' : null;
  const [tab, setTabState] = useState<TabId>(urlTab ?? 'questions');
  const setTab = (t: TabId) => { setTabState(t); setParams((p) => { p.set('tab', t); return p; }, { replace: true }); };

  useEffect(() => {
    AssessmentService.get(id)
      .then((r) => {
        if (!r.data) return setLoadError('Assessment not found');
        setA(r.data);
        if (r.data.status !== 'draft' && !urlTab) setTab('candidates');
      })
      .catch((e) => setLoadError(e?.message || 'Could not load the assessment'));
  }, [id]);

  // A question added with + lands at the bottom: bring it into view once it renders.
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useRef(false);
  useEffect(() => {
    if (!scrollToEnd.current) return;
    scrollToEnd.current = false;
    (listRef.current?.lastElementChild as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [a?.questions.length]);

  // A build task's repo generates in the background: refresh until it's done.
  const generating = !!a?.questions.some((q) => q.check_status === 'generating');
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => AssessmentService.get(id).then((r) => r.data && setA(r.data)).catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [generating, id]);

  /**
   * Run a mutation that returns the full assessment; true on success. An AI
   * change waits for Accept / Reject; any other change accepts it (the server drops the undo too).
   */
  const run = useCallback(async (key: string, fn: () => Promise<{ data?: Assessment }>, ok?: string, ai = false): Promise<boolean> => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.data) {
        const next = r.data;
        setA((prev) => {
          if (ai && prev) {
            // A one-question AI action (key = its id) reviews just that question, not edits from elsewhere.
            const only = (qs: AssessmentQuestion[]) => (prev.questions.some((q) => q.id === key) ? qs.filter((q) => q.id === key) : qs);
            setReview((w) => foldChange(w, only(prev.questions), only(next.questions)));
          }
          return next;
        });
      }
      if (ok) showSuccess(ok);
      return true;
    } catch (e: any) {
      showError(e?.message || 'Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }, [showError, showSuccess]);

  const send = async (text = message) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setMessage('');
    setPending({ role: 'user', content: msg, at: new Date().toISOString() });
    setBusy('chat');
    try {
      setProgress(START_PROGRESS);
      const before = a?.questions ?? [];
      const r = await AssessmentService.chatStream(id, msg, (e) => setProgress((p) => foldProgress(p ?? START_PROGRESS, e)));
      setA(r.assessment);
      setReview((w) => foldChange(w, before, r.assessment.questions));
    } catch (e: any) {
      setMessage(msg);
      showError(e?.message || 'The AI could not build that. Please try again.');
    } finally {
      setPending(null);
      setProgress(null);
      setBusy(null);
    }
  };

  if (loadError) return <Box sx={{ p: 3 }}><Alert severity="error">{loadError}</Alert></Box>;
  if (!a) return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;

  const readOnly = a.status !== 'draft';
  // Choice questions that lose marks for a wrong answer.
  const negativeCount = a.questions.filter((q) => minusOf(q) > 0).length;
  const cancelled = a.status === 'cancelled';
  const flagged = a.questions.filter((q) => q.check_status === 'flagged').length;
  const aiEdit = (q: AssessmentQuestion) => (instruction: string) =>
    run(q.id, () => AssessmentService.aiEdit(id, q.id, instruction), `Q${q.order} updated`, true);
  /** Done reviewing one AI edit (kept or undone). */
  const settle = (qid: string) => setReview((w) => {
    if (!w) return w;
    const marks = { ...w.marks }; delete marks[qid];
    return Object.keys(marks).length || w.removed.length ? { ...w, marks } : null;
  });
  const rejectAi = async (q: AssessmentQuestion) => {
    const mark = review?.marks[q.id];
    const ok = mark === 'added'
      ? await run(q.id, () => AssessmentService.deleteQuestion(id, q.id), 'AI question removed')
      : await run(q.id, () => AssessmentService.updateQuestion(id, q.id, restoreOf(review!.before[q.id] ?? q)), 'Change undone');
    if (ok) settle(q.id);
  };
  const settleRemoved = (qid: string) => setReview((w) => {
    if (!w) return w;
    const removed = w.removed.filter((x) => x.id !== qid);
    return Object.keys(w.marks).length || removed.length ? { ...w, removed } : null;
  });
  /** Settings while drafting: saved as soon as one changes. */
  const saveSettings = (patch: Parameters<typeof AssessmentService.updateSettings>[1], ok: string) => run('settings', () => AssessmentService.updateSettings(id, patch), ok);
  const live = a.mode === 'live';
  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this assessment?',
      body: a.status === 'final'
        ? "Pending invite links stop working, and invited candidates get an email saying it's cancelled. This can't be undone."
        : "This draft stays in your list as Cancelled and can't be edited again.",
      confirmLabel: 'Cancel assessment', cancelLabel: 'Keep it', danger: true,
    });
    if (!ok) return;
    if (await run('cancel', () => AssessmentService.cancel(id), 'Assessment cancelled')) setSettingsOpen(false);
  };
  const finalize = async () => {
    const unchecked = a?.questions.filter((q) => q.check_status === 'unchecked').length ?? 0;
    if (!(await confirm({
      title: 'Finalize this assessment?',
      body: `${unchecked ? `First, the AI checks ${unchecked} answer key${unchecked === 1 ? '' : 's'} by solving each question again without the key. Anything that doesn't match is flagged for you. ` : ''}Then the paper is locked: you can't edit its questions, and you can start inviting candidates.`,
      confirmLabel: unchecked ? 'Check and finalize' : 'Finalize',
    }))) return;
    if (await run('finalize', () => AssessmentService.finalize(id), 'Assessment is live. You can invite candidates now.')) {
      setTab('candidates');
    } else {
      // A flagged check stops finalize: reload so the flagged questions show.
      AssessmentService.get(id).then((r) => r.data && setA(r.data)).catch(() => undefined);
    }
  };
  const chat = pending ? [...a.chat, pending] : a.chat;

  const deliverable = DELIVERABLES.find((d) => d.value === (a.deliverable_type ?? 'code'))!;
  const meta: Array<{ icon: ReactNode; text: string; hint: string }> = [
    { icon: live ? <MdQuiz /> : <MdAssignment />, text: MODE_LABEL[a.mode], hint: 'Type' },
    ...(a.role ? [{ icon: <MdWorkOutline />, text: a.role, hint: 'Role' }] : []),
    { icon: <MdTimer />, text: live ? `${formatDuration(a.mode, a.duration_min)} limit` : `Due in ${formatDuration(a.mode, a.duration_min)}`, hint: live ? 'Time limit' : 'Time to finish' },
    live
      ? { icon: <MdVerifiedUser />, text: a.helper_required === false ? 'Helper off' : 'Helper on', hint: 'Trueyy Helper' }
      : { icon: deliverable.icon, text: deliverable.label, hint: 'Hand in' },
    ...(live ? [{ icon: <MdBalance />, text: marksLabel(paperMax(a.questions)), hint: 'Total marks: each question’s answer marks plus its explanation marks' }] : []),
    ...(live && negativeCount > 0 ? [{ icon: <MdRemoveCircleOutline />, text: `Negative marking on ${negativeCount} question${negativeCount === 1 ? '' : 's'}`, hint: 'Wrong answers lose marks on these; blank answers lose nothing' }] : []),
  ];
  const add = async () => {
    scrollToEnd.current = true;
    if (!(await run('add', () => AssessmentService.addQuestion(id, blankQuestion(a.mode, a.deliverable_type)), live ? 'Question added' : 'Task added'))) scrollToEnd.current = false;
  };
  const showCandidates = readOnly && tab === 'candidates';

  return (
    // The paper scrolls on the left; the AI chat sits in a narrow panel on the right.
    <Box sx={{ width: '100%', height: { md: '100%' }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 0 }}>
    <Box sx={{ flex: 1, minWidth: 0, height: { md: '100%' }, overflowY: { md: 'auto' }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, boxSizing: 'border-box' }}>
      <Box sx={{ maxWidth: showCandidates ? 1200 : 860, mx: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: a.title }]} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
            {readOnly ? (
              <PageTitle sx={{ color: TOKENS.textPrimary }}>{a.title}</PageTitle>
            ) : (
              <Box sx={{ fontSize: '1.4rem', fontWeight: 700, width: `${Math.min(40, Math.max(8, a.title.length + 2))}ch`, maxWidth: '100%' }}>
                <InlineText label="Title" value={a.title} onSave={(title) => saveSettings({ title }, 'Title saved')} sx={{ fontSize: '1.4rem', fontWeight: 700 }} />
              </Box>
            )}
            <StatusTag status={STATUS_TAG[a.status][0]} label={STATUS_TAG[a.status][1]} />
            <Box sx={{ flex: 1 }} />
            {readOnly && (
              <ActionButton variant="secondary" onClick={() => setTab(tab === 'questions' ? 'candidates' : 'questions')}>
                {tab === 'questions' ? 'View candidates' : 'View questions'}
              </ActionButton>
            )}
            {a.status === 'final' && (
              <Tooltip title="Invite candidates">
                <IconButton aria-label="Invite candidates" onClick={() => navigate(`/assessments/${a.id}/invite`)}
                  sx={{ border: `1px solid ${TOKENS.border}`, borderRadius: '10px', bgcolor: '#fff', color: TOKENS.success, '&:hover': { bgcolor: TOKENS.brandBg, borderColor: TOKENS.brand } }}>
                  <MdPersonAddAlt1 />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Settings">
              <IconButton aria-label="Settings" onClick={() => setSettingsOpen(true)} sx={{ border: `1px solid ${TOKENS.border}`, borderRadius: '10px', bgcolor: '#fff', color: TOKENS.textSecondary, '&:hover': { color: TOKENS.textPrimary, bgcolor: TOKENS.bg } }}>
                <MdSettings />
              </IconButton>
            </Tooltip>
            {!readOnly && (
              <Tooltip title={a.questions.length === 0 ? 'Add questions first' : flagged ? `Fix or accept ${flagged} flagged question${flagged > 1 ? 's' : ''}` : ''}>
                <span>
                  <ActionButton onClick={finalize} loading={busy === 'finalize'} disabled={!!busy || flagged > 0 || a.questions.length === 0}>
                    {busy === 'finalize' ? 'Checking answers…' : 'Finalize'}
                  </ActionButton>
                </span>
              </Tooltip>
            )}
          </Box>
          {/* Settings at a glance; on a draft each one opens Settings. */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {meta.map((m) => (
              <Tooltip key={m.hint} title={readOnly ? m.hint : `${m.hint}: click to change`}>
                <Box component={readOnly ? 'span' : 'button'} type={readOnly ? undefined : 'button'} onClick={readOnly ? undefined : () => setSettingsOpen(true)}
                  sx={{
                    all: 'unset', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: '8px',
                    fontSize: '0.82rem', fontWeight: 500, color: TOKENS.textPrimary, bgcolor: '#fff', border: `1px solid ${TOKENS.border}`,
                    '& svg': { fontSize: '1rem', color: TOKENS.textSecondary },
                    ...(!readOnly && { cursor: 'pointer', '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 } }),
                  }}>
                  {m.icon}{m.text}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>

        {cancelled && (
          <Alert severity="error" sx={{ borderRadius: '10px' }}>
            This assessment is cancelled. It can't be edited, and its invite links no longer work.
          </Alert>
        )}

        {showCandidates ? <CandidatesTab a={a} /> : (
          <>
            {/* Pinned to the scroll area's very top (over its padding), so nothing shows through above it. */}
            <Box sx={{ position: 'sticky', top: { xs: -16, md: -24 }, mt: -2, pt: 3, pb: 1, zIndex: 3, bgcolor: TOKENS.bg, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 40 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: TOKENS.textPrimary, flex: 1 }}>
                  {live ? 'Questions' : 'Tasks'}
                  {flagged > 0 && <Box component="span" sx={{ color: '#92400E', fontWeight: 600 }}> · {flagged} flagged</Box>}
                </Typography>
                {!readOnly && (
                  <Tooltip title={ai ? 'AI help is on' : 'AI help is off: you write the questions'}>
                    <FormControlLabel sx={{ m: 0, gap: 0.5 }}
                      control={<Switch size="small" checked={ai} onChange={(e) => setAi(e.target.checked)} />}
                      label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: TOKENS.textSecondary }}>AI</Typography>} />
                  </Tooltip>
                )}
                {!readOnly && (
                  <ActionButton variant="secondary" startIcon={<MdAdd />} onClick={add} disabled={!!busy}>
                    {live ? 'Add question' : 'Add task'}
                  </ActionButton>
                )}
              </Box>
            </Box>

            {a.questions.length === 0 && !progress?.drafts.length && (
              <Box sx={{ border: `1px dashed ${TOKENS.border}`, borderRadius: '14px', p: 4, textAlign: 'center', color: TOKENS.textSecondary, fontSize: '0.9rem', bgcolor: '#fff' }}>
                {`No ${live ? 'questions' : 'tasks'} yet. ${ai ? 'Ask the AI on the right, or add one.' : 'Add one.'}`}
              </Box>
            )}
            <Box ref={listRef} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {a.questions.map((q) => readOnly ? (
                <QuestionCard key={q.id} q={q} single={a.questions.length === 1} />
              ) : review?.marks[q.id] === 'changed' && review.before[q.id] ? (
                // Waiting for review: what goes (red) and what comes in (green).
                <AiDiffCard key={q.id} before={review.before[q.id]!} after={q} single={a.questions.length === 1} disabled={!!busy}
                  onAccept={() => settle(q.id)} onReject={() => rejectAi(q)}
                  // One piece undone: save it back. One piece kept: it becomes part of the baseline.
                  onUndoPart={(patch) => run(q.id, () => AssessmentService.updateQuestion(id, q.id, patch))}
                  onKeepPart={(next) => setReview((w) => (w ? { ...w, before: { ...w.before, [q.id]: next } } : w))} />
              ) : (
                <EditableQuestion
                  key={q.id}
                  q={q}
                  single={a.questions.length === 1}
                  busy={busy === q.id}
                  disabled={!!busy}
                  ai={ai}
                  aiMark={review?.marks[q.id]}
                  onAcceptAi={() => settle(q.id)}
                  onRejectAi={() => rejectAi(q)}
                  onPatch={(patch) => run(q.id, () => AssessmentService.updateQuestion(id, q.id, patch))}
                  onAskAi={() => setEditing(q)}
                  onRegenerate={() => run(q.id, () => AssessmentService.regenerate(id, q.id), `Q${q.order} rewritten`, true)}
                  onAcceptKey={() => run(q.id, () => AssessmentService.acceptKey(id, q.id))}
                  onDelete={async () => {
                    if (await confirm({ title: `Delete ${live ? 'question' : 'task'} ${q.order}?`, body: 'The others are renumbered.', confirmLabel: 'Delete', danger: true })) {
                      run(q.id, () => AssessmentService.deleteQuestion(id, q.id), `${live ? 'Question' : 'Task'} ${q.order} deleted`);
                    }
                  }}
                />
              ))}
              {review?.removed.map((q) => (
                <Box key={q.id} sx={{ position: 'relative', border: '2px dashed #FCA5A5', borderRadius: '14px', p: 2.5, bgcolor: '#FEF2F2' }}>
                  <AiReviewBar label="AI removed" onReject={async () => { scrollToEnd.current = true; if (await run('restore', () => AssessmentService.addQuestion(id, restoreOf(q)), 'Question restored')) settleRemoved(q.id); }} onAccept={() => settleRemoved(q.id)} disabled={!!busy} rejectLabel="Restore" />
                  <Typography sx={{ fontSize: '0.9rem', color: '#991B1B', textDecoration: 'line-through' }}>{q.prompt}</Typography>
                </Box>
              ))}
              {/* Questions the AI has written in this turn, before they're checked and saved. */}
              {progress?.drafts.map((d, i) => <DraftCard key={i} q={d} checking={progress.stage === 'checking'} />)}
            </Box>

          </>
        )}
        <Box sx={{ pb: 3 }} />
      </Box>
    </Box>

      {!readOnly && ai && (
        chatOpen ? (
          <Box component="aside" aria-label="AI assistant" sx={{ width: { md: `min(${chatWidth}px, 42vw)` }, flexShrink: 0, height: { md: '100%' }, p: 2, pl: { md: 0 }, boxSizing: 'border-box', display: 'flex' }}>
            {/* Drag (or arrow keys) to resize; the width is remembered. */}
            <Box role="separator" aria-orientation="vertical" aria-label="Resize AI panel" aria-valuenow={chatWidth} aria-valuemin={CHAT_MIN} aria-valuemax={CHAT_MAX} tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft') resizeChat(chatWidth + 20); if (e.key === 'ArrowRight') resizeChat(chatWidth - 20); }}
              sx={{
                display: { xs: 'none', md: 'flex' }, width: 12, flexShrink: 0, cursor: 'col-resize', justifyContent: 'center', alignItems: 'center', touchAction: 'none',
                '&::after': { content: '""', width: 3, height: 36, borderRadius: 2, bgcolor: TOKENS.border, transition: 'background-color 0.15s' },
                '&:hover::after, &:focus-visible::after': { bgcolor: TOKENS.brand }, '&:focus-visible': { outline: 'none' },
              }} />
            <Box sx={{ flex: 1, minWidth: 0, height: { xs: 560, md: '100%' } }}>
              <ChatPanel mode={a.mode} chat={chat} busy={busy === 'chat'} progress={progress} blocked={!!busy} readOnly={readOnly}
                message={message} onMessage={setMessage} onSend={send}
                initial={(user?.first_name || user?.email || '?').charAt(0).toUpperCase()} onHide={() => setChatOpen(false)} />
            </Box>
          </Box>
        ) : (
          // Collapsed: AI stays on; a slim strip brings the chat back.
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0, my: 2, mr: 2, pt: 1, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', bgcolor: '#fff' }}>
            <Tooltip title="Show AI chat" placement="left">
              <IconButton aria-label="Show AI chat" onClick={() => setChatOpen(true)} sx={{ color: TOKENS.success }}>
                <HugeiconsIcon icon={SidebarRight01Icon} size={20} color="currentColor" />
              </IconButton>
            </Tooltip>
          </Box>
        )
      )}

      {settingsOpen && (
        <SettingsDialog a={a} busy={busy === 'settings' || busy === 'cancel'} onClose={() => setSettingsOpen(false)} onCancelAssessment={cancel}
          onSave={(patch) => run('settings', () => AssessmentService.updateSettings(id, patch), 'Settings saved')} />
      )}
      {editing && <AiEditDialog question={editing} onClose={() => setEditing(null)} onAsk={aiEdit(editing)} />}
      {dialog}
    </Box>
  );
}
