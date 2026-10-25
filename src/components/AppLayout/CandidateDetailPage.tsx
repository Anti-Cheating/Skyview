import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem } from '@mui/material';
import { Add as AddIcon, ChevronRight, DeleteForeverOutlined as EraseIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { Breadcrumb } from '../common/Breadcrumb';
import { StatusTag } from '../common/StatusTag';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { CandidatesService, type CandidateDetail, type CandidateTimelineStep } from '../../services/candidates.service';
import { STEP_KIND, stepStatus } from './CandidatesListPage';

/** Where a step opens: an interview round, a test's result once submitted, else the test. */
function stepUrl(s: CandidateTimelineStep): string {
  if (s.kind === 'interview') return `/interviews/${s.process_id}/rounds/${s.id}`;
  return s.status === 'COMPLETED' && s.result ? `/assessments/${s.assessment_id}/results/${s.result.id}` : `/assessments/${s.assessment_id}`;
}

/** The small line under a step's name: role, interviewer, score or grading. */
function stepDetail(s: CandidateTimelineStep): string {
  const parts = [s.role];
  if (s.kind === 'interview') {
    if (s.interviewer) parts.push(`with ${s.interviewer}`);
    if (s.score != null) parts.push(`score ${s.score}`);
  } else if (s.status === 'COMPLETED') {
    parts.push(s.result?.grading_status === 'done' ? 'graded' : 'grading');
  }
  return parts.join(' · ');
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
};

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  const canErase = ['Owner', 'Admin'].includes(user?.role ?? '') || !!user?.is_super_admin;

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    CandidatesService.get(candidateId)
      .then((r) => setData(r.data ?? null))
      .catch((e: any) => showError(e?.message || 'Failed to load candidate'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const handleErase = async () => {
    if (!candidateId) return;
    setErasing(true);
    try {
      const r = await CandidatesService.erase(candidateId);
      if (r.success) { showSuccess('Candidate data erased'); navigate('/candidates'); }
      else showError(r.message || 'Could not erase the candidate’s data');
    } catch (e: any) {
      showError(e?.message || 'Could not erase the candidate’s data');
    } finally { setErasing(false); setEraseOpen(false); }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (!data) {
    return <Box sx={{ p: 3 }}><Secondary sx={{ color: TOKENS.textSecondary }}>Candidate not found.</Secondary></Box>;
  }

  const c = data.candidate;
  const name = `${c.first_name} ${c.last_name}`.trim() || c.email;
  const done = data.steps.filter((s) => s.status === 'COMPLETED').length;
  const prefill = new URLSearchParams({ first: c.first_name, last: c.last_name, email: c.email }).toString();

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header — name, then add a step / erase */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>{name}</PageTitle>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {canErase && (
            <ActionButton
              variant="secondary"
              onClick={() => setEraseOpen(true)}
              startIcon={<EraseIcon />}
              sx={{ color: '#B42318', borderColor: 'rgba(180,35,24,0.35)', '&:hover': { borderColor: '#B42318', bgcolor: 'rgba(180,35,24,0.04)' } }}
            >
              Erase candidate data
            </ActionButton>
          )}
          <ActionButton onClick={(e: React.MouseEvent<HTMLElement>) => setAddAnchor(e.currentTarget)} startIcon={<AddIcon />}>Add step</ActionButton>
          <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {data.processes.map((p) => (
              <MenuItem key={p.id} onClick={() => navigate(`/interviews/${p.id}?add=1`)} sx={{ fontSize: '0.875rem' }}>
                Interview round · {p.role}
              </MenuItem>
            ))}
            <MenuItem onClick={() => navigate(`/interviews/new?${prefill}`)} sx={{ fontSize: '0.875rem' }}>Interview for a new role</MenuItem>
            <MenuItem onClick={() => navigate('/assessments')} sx={{ fontSize: '0.875rem' }}>Test or assignment</MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ mt: 0.75, mb: 2 }}>
        <Breadcrumb items={[{ label: 'Candidates', to: '/candidates' }, { label: name }]} />
      </Box>

      {/* Details card */}
      <Box sx={{ bgcolor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2.5, mb: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, auto)' }, rowGap: 1.5, columnGap: 5, justifyContent: 'start' }}>
        {[
          ['Email', c.email],
          ['Applying for', data.processes.map((p) => p.role).join(', ')],
          ['Progress', `${done} of ${data.steps.length} steps done`],
        ].map(([label, value]) => (
          <Box key={label}>
            <Caption sx={{ color: TOKENS.textMuted, display: 'block', mb: 0.25 }}>{label}</Caption>
            <Box sx={{ fontSize: '0.875rem', color: TOKENS.textPrimary }}>{value}</Box>
          </Box>
        ))}
      </Box>

      {/* Timeline — every step in time order: tests, assignments and interview rounds */}
      {data.steps.length === 0 ? (
        <Secondary sx={{ color: TOKENS.textSecondary }}>No steps yet. Use Add step to send a test or schedule an interview.</Secondary>
      ) : (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', maxWidth: 820 }}>
          {data.steps.map((s, i) => {
            const st = stepStatus(s.status);
            const when = fmtWhen(s.at);
            const last = i === data.steps.length - 1;
            return (
              <Box component="li" key={s.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '20px 1fr', sm: '72px 20px 1fr' }, columnGap: 1.5 }}>
                {/* Date */}
                <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', pt: 1.75 }}>
                  <Box sx={{ fontSize: '0.8125rem', fontWeight: 600, color: TOKENS.textPrimary }}>{when.day}</Box>
                  <Caption sx={{ color: TOKENS.textMuted }}>{when.time}</Caption>
                </Box>
                {/* Rail: dot + line to the next step */}
                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  {!last && <Box sx={{ position: 'absolute', top: 30, bottom: -6, width: 2, bgcolor: TOKENS.border }} />}
                  <Box sx={{ mt: 2, width: 14, height: 14, borderRadius: '50%', border: `2px solid ${st.dot}`, bgcolor: st.filled ? st.dot : TOKENS.bgCard, position: 'relative' }} />
                </Box>
                {/* Card */}
                <Box
                  component={RouterLink}
                  to={stepUrl(s)}
                  sx={{
                    mb: 1.5, p: 1.75, borderRadius: '10px', border: `1px solid ${TOKENS.border}`, bgcolor: TOKENS.bgCard,
                    display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit', minWidth: 0,
                    transition: 'border-color 0.15s', '&:hover': { borderColor: TOKENS.brand }, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}`, outlineOffset: 2 },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box sx={{ fontSize: '0.9375rem', fontWeight: 600, color: TOKENS.textPrimary }}>{s.name}</Box>
                      <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 600, px: 0.75, py: 0.25, borderRadius: '4px', bgcolor: s.kind === 'interview' ? '#F3F4F6' : 'rgba(59,130,246,0.12)', color: s.kind === 'interview' ? '#374151' : '#2563EB' }}>
                        {STEP_KIND[s.kind]}
                      </Box>
                    </Box>
                    <Caption sx={{ color: TOKENS.textSecondary, display: 'block', mt: 0.25 }}>
                      <Box component="span" sx={{ display: { sm: 'none' } }}>{when.day} · </Box>{stepDetail(s)}
                    </Caption>
                  </Box>
                  <StatusTag status={st.tag} label={st.label} />
                  <ChevronRight sx={{ color: TOKENS.textMuted, fontSize: 20 }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Erase confirm */}
      <Dialog open={eraseOpen} onClose={() => !erasing && setEraseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Erase candidate data?</DialogTitle>
        <DialogContent>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            This permanently deletes <strong>{name}</strong>’s recordings, transcripts, and screenshots from your interviews. This can’t be undone.
          </Secondary>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={() => setEraseOpen(false)} disabled={erasing}>Keep data</ActionButton>
          <ActionButton onClick={handleErase} loading={erasing} sx={{ bgcolor: '#B42318', '&:hover': { bgcolor: '#912018' } }}>Erase data</ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
