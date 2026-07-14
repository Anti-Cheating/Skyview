import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Typography, IconButton, Tooltip,
} from '@mui/material';
import { Add as AddIcon, EditOutlined as EditIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption, CardTitle } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { INPUT_SX, LABEL_SX } from '../common/formTokens';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { Breadcrumb } from '../common/Breadcrumb';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ProcessService } from '../../services/process.service';
import { InterviewService } from '../../services/interview.service';
import { InvitesService, type TeamMember } from '../../services/invites.service';
import type { ProcessDetail, RoundSummary } from '../../types/process.types';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const ROUND_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: 'rgba(59,130,246,0.12)', fg: '#2563EB' },
  ACTIVE: { label: 'Live', bg: 'rgba(76,217,100,0.14)', fg: '#047857' },
  COMPLETED: { label: 'Completed', bg: '#F3F4F6', fg: '#4B5563' },
  CANCELLED: { label: 'Cancelled', bg: '#F3F4F6', fg: '#9CA3AF' },
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProcessDetailPage() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const [data, setData] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRound, setEditRound] = useState<RoundSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoundSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    if (!processId) return;
    setLoading(true);
    ProcessService.getById(processId)
      .then((r) => setData(r.data ?? null))
      .catch((e: any) => showError(e?.message || 'Failed to load interview'))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [processId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.company_id) return;
    InvitesService.listMembers(user.company_id, { pageSize: 100 })
      .then((r) => { if (r.success && r.data) setMembers(r.data.items); })
      .catch(() => {});
  }, [user?.company_id]);

  const candidate = data?.candidate;
  const onlyRound = (data?.rounds.length ?? 0) <= 1;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (onlyRound) {
        // The only round — cancelling it cancels the whole interview.
        const r = await ProcessService.cancel(processId!);
        if (r.success) {
          showSuccess('Interview cancelled');
          navigate('/interviews');
        } else {
          showError(r.message || 'Could not cancel the interview');
        }
      } else {
        const r = await InterviewService.remove(deleteTarget.id);
        if (r.success) {
          showSuccess('Round cancelled');
          setDeleteTarget(null);
          refresh();
        } else {
          showError(r.message || 'Could not cancel the round');
        }
      }
    } catch (e: any) {
      showError(e?.message || 'Could not cancel');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<DataTableColumn<RoundSummary>[]>(
    () => [
      {
        key: 'round',
        header: 'Round',
        render: (r) => (
          <Box
            component="button"
            onClick={() => navigate(`/interviews/${processId}/rounds/${r.id}`)}
            sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', textAlign: 'left', color: TOKENS.textPrimary, fontWeight: 600, '&:hover': { color: TOKENS.brand } }}
          >
            {r.round_order} · {r.round_name}
          </Box>
        ),
      },
      {
        key: 'interviewer',
        header: 'Interviewer',
        hideOn: 'mobile',
        render: (r) => (
          <Box sx={{ color: r.interviewer ? TOKENS.textPrimary : TOKENS.textMuted }}>
            {r.interviewer ? `${r.interviewer.first_name} ${r.interviewer.last_name}`.trim() : 'Unassigned'}
          </Box>
        ),
      },
      { key: 'scheduled', header: 'Scheduled', hideOn: 'mobile', render: (r) => <Caption sx={{ color: TOKENS.textSecondary }}>{fmtDateTime(r.scheduled_start_at)}</Caption> },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (r) => {
          const c = ROUND_STATUS[r.status] ?? ROUND_STATUS.SCHEDULED;
          return <Chip label={c.label} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: c.bg, color: c.fg }} />;
        },
      },
      {
        key: 'analysis',
        header: 'Analysis',
        width: 120,
        render: (r) =>
          r.analysis && r.analysis.overall_score != null ? (
            <Chip label={`${r.analysis.overall_score} · ${r.analysis.risk_level ?? '—'}`} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: 'rgba(76,217,100,0.12)', color: '#047857' }} />
          ) : (
            <Caption sx={{ color: TOKENS.textMuted }}>—</Caption>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        width: 96,
        render: (r) => {
          const terminal = r.status === 'COMPLETED' || r.status === 'CANCELLED';
          return (
            <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
              <Tooltip title={terminal ? 'Completed rounds can’t be edited' : 'Edit round'}>
                <span>
                  <IconButton size="small" disabled={terminal} onClick={() => setEditRound(r)} sx={{ color: TOKENS.textSecondary }}>
                    <EditIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={onlyRound ? 'Cancel interview (only round)' : terminal ? 'Already finished' : 'Cancel round'}>
                <span>
                  <IconButton size="small" disabled={terminal} onClick={() => setDeleteTarget(r)} sx={{ color: TOKENS.error }}>
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [processId, onlyRound] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (loading && !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: TOKENS.brand }} /></Box>;
  }
  if (!data || !candidate) {
    return (
      <Box sx={{ p: 3 }}>
        <Breadcrumb items={[{ label: 'Dashboard', to: '/' }, { label: 'Interviews', to: '/interviews' }, { label: 'Not found' }]} />
        <Box sx={{ color: TOKENS.textSecondary }}>Interview not found.</Box>
      </Box>
    );
  }

  const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim() || candidate.email;
  const done = data.status === 'COMPLETED';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>{data.role}</PageTitle>
      </Box>
      {/* Breadcrumb sits below the title */}
      <Box sx={{ mt: 0.75, mb: 2 }}>
        <Breadcrumb items={[{ label: 'Interviews', to: '/interviews' }, { label: data.role }]} />
      </Box>

      {/* Process details — end to end */}
      <Box sx={{ bgcolor: TOKENS.bgCard, border: `1px solid ${TOKENS.border}`, borderRadius: '12px', p: 2.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <CardTitle sx={{ color: TOKENS.textPrimary, fontSize: '0.95rem' }}>Details</CardTitle>
          <ActionButton variant="secondary" onClick={() => setEditOpen(true)}>Edit</ActionButton>
        </Box>
        {/* Candidate — avatar + name + email */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 2, mb: 2, borderBottom: `1px solid ${TOKENS.border}` }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: TOKENS.brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
            {initialsOf(candidate)}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontWeight: 600, fontSize: '0.95rem', color: TOKENS.textPrimary }}>{candidateName}</Box>
            <Box sx={{ color: TOKENS.textSecondary, fontSize: '0.85rem' }}>{candidate.email}</Box>
          </Box>
        </Box>
        {/* Metadata */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, rowGap: 1.75, columnGap: 4 }}>
          <DetailRow label="Role" value={data.role} />
          <DetailRow label="Status" node={<StatusInline done={done} />} />
          <DetailRow label="Rounds" value={`${data.rounds.filter((r) => r.status === 'COMPLETED').length}/${data.rounds.length} completed`} />
          <DetailRow label="Created by" value={data.created_by_name ?? '—'} />
          <DetailRow label="Created on" value={new Date(data.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} />
          {data.description ? <DetailRow label="Description" value={data.description} /> : null}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <CardTitle sx={{ color: TOKENS.textPrimary }}>Rounds</CardTitle>
        <ActionButton onClick={() => setAddOpen(true)} startIcon={<AddIcon />}>Add round</ActionButton>
      </Box>
      <DataTable<RoundSummary> columns={columns} rows={data.rounds} rowKey={(r) => r.id} emptyText="No rounds." />

      {addOpen && (
        <RoundDialog
          mode="add"
          processId={processId!}
          candidate={candidate}
          members={members}
          defaultInterviewer={user?.id}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); showSuccess('Round added'); refresh(); }}
          onError={showError}
        />
      )}
      {editRound && (
        <RoundDialog
          mode="edit"
          processId={processId!}
          candidate={candidate}
          members={members}
          round={editRound}
          onClose={() => setEditRound(null)}
          onSaved={() => { setEditRound(null); showSuccess('Round updated'); refresh(); }}
          onError={showError}
        />
      )}
      {editOpen && (
        <EditProcessDialog
          process={data}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); showSuccess('Interview updated'); refresh(); }}
          onError={showError}
        />
      )}

      {/* Delete round confirm */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{onlyRound ? 'Cancel interview?' : 'Cancel this round?'}</DialogTitle>
        <DialogContent>
          <Secondary sx={{ color: TOKENS.textSecondary }}>
            {deleteTarget
              ? onlyRound
                ? `“${deleteTarget.round_name}” is the only round, so cancelling it will cancel the whole interview. This can’t be undone.`
                : `Round ${deleteTarget.round_order} · ${deleteTarget.round_name} will be cancelled. This can’t be undone.`
              : ''}
          </Secondary>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{onlyRound ? 'Keep interview' : 'Keep round'}</ActionButton>
          <ActionButton onClick={handleDelete} loading={deleting}>{onlyRound ? 'Cancel interview' : 'Cancel round'}</ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function initialsOf(c: { first_name: string; last_name: string; email: string }): string {
  const a = c.first_name?.[0] ?? '';  
  const b = c.last_name?.[0] ?? '';
  return (a + b).toUpperCase() || c.email[0]?.toUpperCase() || '?';
}

function StatusInline({ done }: { done: boolean }) {
  return (
    <Chip
      label={done ? 'Completed' : 'In progress'}
      size="small"
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: done ? 'rgba(76,217,100,0.14)' : 'rgba(59,130,246,0.12)',
        color: done ? '#047857' : '#2563EB',
      }}
    />
  );
}

function DetailRow({ label, value, node }: { label: string; value?: string; node?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
      <Box sx={{ width: 92, flexShrink: 0, color: TOKENS.textMuted, fontSize: '0.8125rem' }}>{label}</Box>
      <Box sx={{ color: TOKENS.textPrimary, fontSize: '0.875rem', fontWeight: 500, minWidth: 0 }}>{node ?? value}</Box>
    </Box>
  );
}

/** Add or edit a round. In edit mode it prefills from the existing session. */
function RoundDialog({
  mode, processId, candidate, members, defaultInterviewer, round, onClose, onSaved, onError,
}: {
  mode: 'add' | 'edit';
  processId: string;
  candidate: { email: string; first_name: string; last_name: string };
  members: TeamMember[];
  defaultInterviewer?: string;
  round?: RoundSummary;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [ready, setReady] = useState(mode === 'add');
  const [roundName, setRoundName] = useState(round?.round_name ?? '');
  const [interviewerUserId, setInterviewerUserId] = useState(defaultInterviewer ?? '');
  const [origInterviewer, setOrigInterviewer] = useState('');
  const [startDateTime, setStartDateTime] = useState<Dayjs | null>(dayjs().add(1, 'hour').startOf('hour'));
  const [duration, setDuration] = useState(60);
  const [meetingLink, setMeetingLink] = useState('');
  const [origMeetingLink, setOrigMeetingLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !round) return;
    InterviewService.getById(round.id)
      .then((r) => {
        const s = r.data;
        if (!s) { onError('Failed to load round'); return; }
        const iv = s.interview_session_participants?.find((p) => p.interviewer_id)?.interviewer_id ?? '';
        setInterviewerUserId(iv);
        setOrigInterviewer(iv);
        const link = (s.provider_metadata?.join_url as string | undefined) ?? '';
        setMeetingLink(link);
        setOrigMeetingLink(link);
        const start = dayjs(s.scheduled_start_at);
        setStartDateTime(start);
        setDuration(Math.max(15, Math.round(dayjs(s.scheduled_end_at).diff(start, 'minute'))));
      })
      .catch(() => onError('Failed to load round'))
      .finally(() => setReady(true));
  }, [mode, round?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!roundName.trim()) return setError('Round name is required');
    if (!interviewerUserId) return setError('Pick an interviewer');
    if (!startDateTime || !startDateTime.isValid() || startDateTime.isBefore(dayjs())) return setError('Pick a valid future time');
    if (!meetingLink.trim()) return setError('Meeting link is required');
    try { new URL(meetingLink.trim()); } catch { return setError('Meeting link must be a valid URL'); }
    setSaving(true);
    setError(null);
    try {
      const startAt = startDateTime.toDate();
      const endAt = new Date(startAt.getTime() + duration * 60 * 1000);
      if (mode === 'add') {
        const r = await ProcessService.addRound(processId, {
          round_name: roundName.trim(),
          interviewer_user_id: interviewerUserId,
          scheduled_start_at: startAt.toISOString(),
          scheduled_end_at: endAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          meeting_link: meetingLink.trim(),
        });
        if (r.success) onSaved(); else onError(r.message || 'Failed to add round');
      } else if (round) {
        const payload: Record<string, unknown> = {
          round_name: roundName.trim(),
          scheduled_start_at: startAt.toISOString(),
          scheduled_end_at: endAt.toISOString(),
        };
        if (meetingLink.trim() !== origMeetingLink) payload.meeting_link = meetingLink.trim();
        if (interviewerUserId && interviewerUserId !== origInterviewer) {
          payload.interview_session_participants = [
            { candidate_email: candidate.email, candidate_first_name: candidate.first_name, candidate_last_name: candidate.last_name },
            { interviewer_user_id: interviewerUserId },
          ];
        }
        const r = await InterviewService.update(round.id, payload);
        if (r.success) onSaved(); else onError(r.message || 'Failed to update round');
      }
    } catch (e: any) {
      onError(e?.message || 'Failed to save round');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{mode === 'add' ? 'Add round' : 'Edit round'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        {!ready ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: TOKENS.brand }} /></Box>
        ) : (
          <>
            {error && <Typography sx={{ color: TOKENS.error, fontSize: '0.8125rem' }}>{error}</Typography>}
            <FormField label="Round name" required placeholder="Managerial" value={roundName} onChange={(e) => setRoundName(e.target.value)} disabled={saving} />
            <FormField label="Interviewer" required select value={interviewerUserId} onChange={(e) => setInterviewerUserId(e.target.value)} disabled={saving}>
              {members.map((m) => (
                <MenuItem key={m.id} value={m.id}>{[m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email}</MenuItem>
              ))}
            </FormField>
            <Box>
              <Box sx={LABEL_SX}><span>Schedule</span><Box component="span" sx={{ color: TOKENS.errorLight, fontWeight: 700 }}>*</Box></Box>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker value={startDateTime} onChange={(v) => setStartDateTime(v)} disabled={saving} disablePast minutesStep={15} slotProps={{ textField: { fullWidth: true, size: 'small', sx: INPUT_SX } }} />
              </LocalizationProvider>
            </Box>
            <FormField label="Duration" required select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))} disabled={saving}>
              {DURATIONS.map((d) => (<MenuItem key={d} value={String(d)}>{d} minutes</MenuItem>))}
            </FormField>
            <FormField label="Meeting Link" required placeholder="https://meet.google.com/abc-defg-hij" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} disabled={saving} />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</ActionButton>
        <ActionButton onClick={submit} loading={saving} disabled={!ready}>{mode === 'add' ? 'Add round' : 'Save'}</ActionButton>
      </DialogActions>
    </Dialog>
  );
}

function EditProcessDialog({
  process, onClose, onSaved, onError,
}: {
  process: ProcessDetail;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [role, setRole] = useState(process.role);
  const [description, setDescription] = useState(process.description ?? '');
  const [firstName, setFirstName] = useState(process.candidate.first_name);
  const [lastName, setLastName] = useState(process.candidate.last_name);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!role.trim()) return onError('Role is required');
    setSaving(true);
    try {
      const r = await ProcessService.update(process.id, {
        role: role.trim(),
        description: description.trim() || null,
        candidate_first_name: firstName.trim(),
        candidate_last_name: lastName.trim(),
      });
      if (r.success) onSaved();
      else onError(r.message || 'Failed to update');
    } catch (e: any) {
      onError(e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>Edit interview</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <FormField label="Candidate First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} />
          <FormField label="Candidate Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} />
        </Box>
        <FormField label="Candidate Email" value={process.candidate.email} disabled helperText="Email is fixed after creation." />
        <FormField label="Role" required value={role} onChange={(e) => setRole(e.target.value)} disabled={saving} />
        <FormField label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <ActionButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</ActionButton>
        <ActionButton onClick={submit} loading={saving}>Save</ActionButton>
      </DialogActions>
    </Dialog>
  );
}
