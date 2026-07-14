import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { DeleteForeverOutlined as EraseIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { Breadcrumb } from '../common/Breadcrumb';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { CandidatesService, type CandidateDetail, type CandidateInterview } from '../../services/candidates.service';

function StatusPill({ done }: { done: boolean }) {
  return (
    <Chip
      label={done ? 'Completed' : 'In progress'}
      size="small"
      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: done ? 'rgba(76,217,100,0.14)' : 'rgba(59,130,246,0.12)', color: done ? '#047857' : '#2563EB' }}
    />
  );
}

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [erasing, setErasing] = useState(false);

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
      if (r.success) { showSuccess('Candidate data erased'); navigate('/interviews?view=candidate'); }
      else showError(r.message || 'Could not erase the candidate’s data');
    } catch (e: any) {
      showError(e?.message || 'Could not erase the candidate’s data');
    } finally { setErasing(false); setEraseOpen(false); }
  };

  const columns = useMemo<DataTableColumn<CandidateInterview>[]>(() => [
    { key: 'role', header: 'Role', render: (iv) => <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>{iv.role}</Box> },
    {
      key: 'rounds', header: 'Rounds', width: 110,
      render: (iv) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{iv.rounds.filter((r) => r.status === 'COMPLETED').length}/{iv.rounds.length}</Box>,
    },
    {
      key: 'status', header: 'Status', width: 140,
      render: (iv) => <StatusPill done={iv.rounds.length > 0 && iv.rounds.every((r) => r.status === 'COMPLETED')} />,
    },
    {
      key: 'created', header: 'Created', width: 140, hideOn: 'mobile',
      render: (iv) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{new Date(iv.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</Caption>,
    },
  ], []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (!data) {
    return <Box sx={{ p: 3 }}><Secondary sx={{ color: TOKENS.textSecondary }}>Candidate not found.</Secondary></Box>;
  }

  const c = data.candidate;
  const name = `${c.first_name} ${c.last_name}`.trim() || c.email;
  const totalRounds = data.interviews.reduce((n, iv) => n + iv.rounds.length, 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header — name title + the erase action */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>{name}</PageTitle>
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
      </Box>

      <Box sx={{ mt: 0.75, mb: 2 }}>
        <Breadcrumb items={[{ label: 'Candidates', to: '/interviews?view=candidate' }, { label: name }]} />
      </Box>

      {/* Details card */}
      <Box sx={{ bgcolor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2.5, mb: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, auto)' }, rowGap: 1.5, columnGap: 5 }}>
        {[
          ['Email', c.email],
          ['Interviews', String(data.interviews.length)],
          ['Rounds', String(totalRounds)],
        ].map(([label, value]) => (
          <Box key={label}>
            <Caption sx={{ color: TOKENS.textMuted, display: 'block', mb: 0.25 }}>{label}</Caption>
            <Box sx={{ fontSize: '0.875rem', color: TOKENS.textPrimary }}>{value}</Box>
          </Box>
        ))}
      </Box>

      {/* Interviews — same table as the list; a row opens its process detail. */}
      <DataTable<CandidateInterview>
        columns={columns}
        rows={data.interviews}
        rowKey={(iv) => iv.process_id}
        onRowClick={(iv) => navigate(`/interviews/${iv.process_id}`)}
        emptyText="No interviews for this candidate."
      />

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
