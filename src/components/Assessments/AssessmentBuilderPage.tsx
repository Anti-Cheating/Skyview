import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Chip, CircularProgress, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarRight01Icon } from '@hugeicons/core-free-icons';
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
import { AiEditDialog, RubricDialog } from './QuestionDialogs';
import { ChatPanel } from './ChatPanel';
import { DraftCard, START_PROGRESS, foldProgress, type TurnProgress } from './ChatProgress';
import { CandidatesTab } from './CandidatesTab';
import { ResultsTab } from './ResultsTab';
import { StatusTag } from '../common/StatusTag';

/** Builder: chat on the left, the live paper on the right. */
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
  const [rubricFor, setRubricFor] = useState<AssessmentQuestion | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  // Tab lives in the URL (?tab=results) so Back from a result lands on the same tab.
  type TabId = 'paper' | 'candidates' | 'results';
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') as TabId | null;
  const [tab, setTabState] = useState<TabId>(urlTab ?? 'paper');
  const setTab = (t: TabId) => { setTabState(t); setParams((p) => { p.set('tab', t); return p; }, { replace: true }); };

  useEffect(() => {
    AssessmentService.get(id)
      .then((r) => {
        if (!r.data) return setLoadError('Assessment not found');
        setA(r.data);
        if (r.data.status !== 'draft') { setChatOpen(false); if (!urlTab) setTab('candidates'); } // nothing left to chat about
      })
      .catch((e) => setLoadError(e?.message || 'Could not load the assessment'));
  }, [id]);

  // A build task's repo generates in the background: refresh until it's done.
  const generating = !!a?.questions.some((q) => q.check_status === 'generating');
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => AssessmentService.get(id).then((r) => r.data && setA(r.data)).catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [generating, id]);

  /** Run a mutation that returns the full assessment; true on success. */
  const run = useCallback(async (key: string, fn: () => Promise<{ data?: Assessment }>, ok?: string): Promise<boolean> => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.data) setA(r.data);
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
      const r = await AssessmentService.chatStream(id, msg, (e) => setProgress((p) => foldProgress(p ?? START_PROGRESS, e)));
      setA(r.assessment);
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
  const cancelled = a.status === 'cancelled';
  const flagged = a.questions.filter((q) => q.check_status === 'flagged').length;
  const save = (q: AssessmentQuestion) => (patch: QuestionPatch) => run(q.id, () => AssessmentService.updateQuestion(id, q.id, patch), 'Question saved');
  const aiEdit = (q: AssessmentQuestion) => (instruction: string) =>
    run(q.id, () => AssessmentService.aiEdit(id, q.id, instruction), `Q${q.order} updated`);
  /** AI rubric change; returns the updated question so the dialog can show it. */
  const aiRubric = (q: AssessmentQuestion) => async (instruction: string): Promise<AssessmentQuestion | null> => {
    setBusy(q.id);
    try {
      const r = await AssessmentService.aiEdit(id, q.id, instruction, 'rubric');
      if (!r.data) return null;
      setA(r.data);
      return r.data.questions.find((x) => x.id === q.id) ?? null;
    } catch (e: any) {
      showError(e?.message || 'The AI could not change the rubric. Please try again.');
      return null;
    } finally {
      setBusy(null);
    }
  };
  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel this assessment?',
      body: a.status === 'final'
        ? "Pending invite links stop working, and invited candidates get an email saying it's cancelled. This can't be undone."
        : "This draft stays in your list as Cancelled and can't be edited again.",
      confirmLabel: 'Cancel assessment', cancelLabel: 'Keep it', danger: true,
    });
    if (!ok) return;
    if (await run('cancel', () => AssessmentService.cancel(id), 'Assessment cancelled')) setChatOpen(false);
  };
  const finalize = async () => {
    const unchecked = a?.questions.filter((q) => q.check_status === 'unchecked').length ?? 0;
    if (!(await confirm({
      title: 'Finalize this assessment?',
      body: `${unchecked ? `First, the AI checks ${unchecked} answer key${unchecked === 1 ? '' : 's'} by solving each question again without the key. Anything that doesn't match is flagged for you. ` : ''}Then the paper is locked: you can't edit its questions, and you can start inviting candidates.`,
      confirmLabel: unchecked ? 'Check and finalize' : 'Finalize',
    }))) return;
    if (await run('finalize', () => AssessmentService.finalize(id), 'Assessment finalized. You can invite candidates now.')) {
      setChatOpen(false);
      setTab('candidates');
    } else {
      // A flagged check stops finalize: reload so the flagged questions show.
      AssessmentService.get(id).then((r) => r.data && setA(r.data)).catch(() => undefined);
    }
  };
  const chat = pending ? [...a.chat, pending] : a.chat;

  return (
    <Box sx={{
      width: '100%', height: { md: '100%' }, p: { xs: 2, md: 3 }, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 2, overflow: { md: 'hidden' },
    }}>
      <Box sx={{ flexShrink: 0 }}>
        <Breadcrumb items={[{ label: 'Assessments', to: '/assessments' }, { label: a.title }]} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
          <PageTitle sx={{ color: TOKENS.textPrimary }}>{a.title}</PageTitle>
          <Chip size="small" label={MODE_LABEL[a.mode]} sx={{ bgcolor: TOKENS.borderLight, fontWeight: 600 }} />
          <Chip size="small" label={formatDuration(a.mode, a.duration_min)} sx={{ bgcolor: TOKENS.borderLight }} />
          <StatusTag status={STATUS_TAG[a.status][0]} label={STATUS_TAG[a.status][1]} />
          <Box sx={{ flex: 1 }} />
          {!cancelled && (
            <ActionButton variant="secondary" onClick={cancel} loading={busy === 'cancel'} disabled={!!busy}>
              Cancel assessment
            </ActionButton>
          )}
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
      </Box>

      {cancelled && (
        <Alert severity="error" sx={{ borderRadius: '10px', flexShrink: 0 }}>
          This assessment is cancelled. It can't be edited, and its invite links no longer work.
        </Alert>
      )}

      {readOnly && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          minHeight: 36, flexShrink: 0, borderBottom: `1px solid ${TOKENS.border}`,
          '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', color: TOKENS.textSecondary },
          '& .Mui-selected': { color: `${TOKENS.textPrimary} !important` },
          '& .MuiTabs-indicator': { bgcolor: TOKENS.brand, height: 3, borderRadius: 2 },
        }}>
          <Tab value="candidates" label="Candidates" />
          <Tab value="results" label="Results" />
          <Tab value="paper" label={`Paper · ${a.questions.length}`} />
        </Tabs>
      )}

      {readOnly && tab === 'candidates' ? <CandidatesTab a={a} /> : readOnly && tab === 'results' ? <ResultsTab a={a} /> : (
      /* Chat stays put and fills the height; only the paper scrolls. */
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: chatOpen ? 'minmax(340px, 5fr) minmax(0, 7fr)' : '44px minmax(0, 1fr)' }, gap: 2 }}>
        {!chatOpen && (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', pt: 1, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', bgcolor: '#fff' }}>
            <Tooltip title="Show chat" placement="right">
              <IconButton aria-label="Show chat" onClick={() => setChatOpen(true)} sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.success, bgcolor: TOKENS.brandBg } }}>
                <HugeiconsIcon icon={SidebarRight01Icon} size={20} color="currentColor" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {chatOpen && <ChatPanel
          mode={a.mode}
          chat={chat}
          busy={busy === 'chat'}
          progress={progress}
          blocked={!!busy}
          readOnly={readOnly}
          message={message}
          onMessage={setMessage}
          onSend={send}
          initial={(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
          onHide={() => setChatOpen(false)}
        />}

        <Box sx={{ minWidth: 0, minHeight: 0, overflowY: { md: 'auto' }, pr: { md: 0.5 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: TOKENS.textPrimary, flex: 1 }}>
              Paper · {a.questions.length} question{a.questions.length === 1 ? '' : 's'}
              {flagged > 0 && <Box component="span" sx={{ color: '#92400E', fontWeight: 600 }}> · {flagged} flagged</Box>}
            </Typography>
          </Box>
          {a.questions.length === 0 && !progress?.drafts.length && (
            <Box sx={{ border: `1px dashed ${TOKENS.border}`, borderRadius: '12px', p: 4, textAlign: 'center', color: TOKENS.textSecondary, fontSize: '0.85rem', bgcolor: '#fff' }}>
              Questions appear here as you chat.
            </Box>
          )}
          {a.questions.map((q) => (
            <QuestionCard
              key={q.id}
              assessmentId={id}
              q={q}
              single={a.questions.length === 1}
              readOnly={readOnly}
              busy={busy === q.id}
              disabled={!!busy}
              onEdit={() => setEditing(q)}
              onRubric={() => setRubricFor(q)}
              onRegenerate={() => run(q.id, () => AssessmentService.regenerate(id, q.id), q.format === 'build' ? `Regenerating Q${q.order}'s repo` : `Q${q.order} regenerated`)}
              onAcceptKey={() => run(q.id, () => AssessmentService.acceptKey(id, q.id))}
              onSetKey={(key) => run(q.id, () => AssessmentService.updateQuestion(id, q.id, { answer_key: key }), `Q${q.order} answer key updated`)}
              onDelete={async () => {
                if (await confirm({ title: `Delete Q${q.order}?`, body: 'The question and its answer key are removed, and the others are renumbered.', confirmLabel: 'Delete question', danger: true })) {
                  run(q.id, () => AssessmentService.deleteQuestion(id, q.id), `Q${q.order} deleted`);
                }
              }}
            />
          ))}
          {/* Questions the AI has written in this turn, before they're checked and saved. */}
          {progress?.drafts.map((d, i) => <DraftCard key={i} q={d} checking={progress.stage === 'checking'} />)}
        </Box>
      </Box>

      )}
      {editing && <AiEditDialog question={editing} onClose={() => setEditing(null)} onAsk={aiEdit(editing)} />}
      {dialog}
      {rubricFor && (
        <RubricDialog question={rubricFor} readOnly={readOnly} onClose={() => setRubricFor(null)} onSave={save(rubricFor)} onAsk={aiRubric(rubricFor)} />
      )}
    </Box>
  );
}
