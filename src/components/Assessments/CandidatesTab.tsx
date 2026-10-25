import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import { MdBlock, MdSend } from 'react-icons/md';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { ActionButton } from '../common/ActionButton';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { StatusTag } from '../common/StatusTag';
import { useConfirm } from '../common/useConfirm';
import { Caption, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentInvite } from '../../types/assessment.types';

const fmt = (iso: string) => dayjs(iso).format('D MMM YYYY, h:mm A');
const fullName = (c: AssessmentInvite['candidate']) => [c.first_name, c.last_name].filter(Boolean).join(' ');

function inviteStatus(i: AssessmentInvite) {
  if (i.status === 'revoked') return <StatusTag status="CANCELLED" label="Revoked" />;
  if (i.status === 'submitted') return <StatusTag status="COMPLETED" label="Submitted" />;
  if (i.status === 'started') return <StatusTag status="IN_PROGRESS" label="In progress" />;
  if (dayjs(i.closes_at).isBefore(dayjs())) return <StatusTag status="SCHEDULED" label="Expired" />;
  if (!i.invite_sent_at) return <StatusTag status="WARNING" label="Email not sent" />;
  return <StatusTag status="SCHEDULED" label="Invited" />;
}

/** Finalized assessment → who's invited and when they can take it. Inviting happens on its own page. */
export function CandidatesTab({ a }: { a: Assessment }) {
  const navigate = useNavigate();
  const { showError, showSuccess } = useSnackbar();
  const [invites, setInvites] = useState<AssessmentInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const live = a.mode === 'live';

  useEffect(() => {
    AssessmentService.listInvites(a.id)
      .then((r) => setInvites(r.data ?? []))
      .catch((e) => { showError(e?.message || 'Could not load candidates'); setInvites([]); });
  }, [a.id, showError]);

  const act = useCallback(async (aid: string, fn: () => Promise<{ data?: AssessmentInvite[] }>, ok: string) => {
    setBusy(aid);
    try {
      const r = await fn();
      if (r.data) setInvites(r.data);
      showSuccess(ok);
    } catch (e: any) {
      showError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }, [showError, showSuccess]);

  const columns = useMemo<DataTableColumn<AssessmentInvite>[]>(() => [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (i) => (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>{fullName(i.candidate) || i.candidate.email}</Box>
          {fullName(i.candidate) && <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{i.candidate.email}</Caption>}
        </Box>
      ),
    },
    { key: 'status', header: 'Status', width: 140, render: inviteStatus },
    {
      key: 'invited',
      header: 'Invited',
      width: 130,
      hideOn: 'mobile',
      render: (i) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {new Date(i.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </Caption>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted at',
      width: 190,
      align: 'right',
      hideOn: 'mobile',
      render: (i) => i.submitted_at ? (
        <Box sx={{ color: TOKENS.textPrimary, fontSize: '0.8125rem' }}>{fmt(i.submitted_at)}</Box>
      ) : (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {i.status === 'started' && i.started_at ? `Started ${fmt(i.started_at)}` : live ? `Window ${fmt(i.opens_at)} to ${fmt(i.closes_at)}` : `Start by ${fmt(i.closes_at)}`}
        </Caption>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 96,
      align: 'right',
      render: (i) => {
        if (busy === i.id) return <CircularProgress size={16} sx={{ color: TOKENS.brand }} />;
        if (a.status !== 'final' || i.status !== 'invited' || dayjs(i.closes_at).isBefore(dayjs())) return null;
        return (
          <Box sx={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Resend with a new link">
              <span>
                <IconButton size="small" aria-label="Resend invite" disabled={!!busy}
                  onClick={() => act(i.id, () => AssessmentService.resendInvite(a.id, i.id), 'Invite sent again')}>
                  <MdSend />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Revoke invite">
              <span>
                <IconButton size="small" aria-label="Revoke invite" disabled={!!busy}
                  onClick={async () => {
                    if (await confirm({ title: 'Revoke this invite?', body: `${i.candidate.email}'s link stops working. You can invite them again later.`, confirmLabel: 'Revoke invite', danger: true })) {
                      act(i.id, () => AssessmentService.revokeInvite(a.id, i.id), 'Invite revoked');
                    }
                  }}>
                  <MdBlock />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    },
  ], [a.id, act, busy, confirm, live]);

  const q = search.trim().toLowerCase();
  const filtered = (invites ?? []).filter((i) => !q || i.candidate.email.toLowerCase().includes(q) || fullName(i.candidate).toLowerCase().includes(q));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const active = (invites ?? []).filter((i) => i.status !== 'revoked').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: { md: 'auto' } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <Secondary sx={{ color: TOKENS.textSecondary, pt: 1 }}>
          {invites ? `${active} candidate${active === 1 ? '' : 's'} invited. ` : ''}
          {live ? 'Each one can start inside their window, with the Trueyy Helper on.' : 'Each one must start by their date.'}
        </Secondary>
        {a.status === 'final' && (
          <ActionButton onClick={() => navigate(`/assessments/${a.id}/invite`)} startIcon={<AddIcon />}>Invite candidates</ActionButton>
        )}
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <SearchField placeholder="Search candidate or email" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>

      <DataTable<AssessmentInvite>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        // A submitted candidate opens their result (the invite id is the attempt id).
        onRowClick={(r) => r.status === 'submitted' && navigate(`/assessments/${a.id}/results/${r.id}`)}
        loading={invites === null}
        emptyText={q ? 'No candidates match your search.' : 'No candidates yet. Invite some to get started.'}
        pagination={{ page, pageSize, total: filtered.length, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
      {dialog}
    </Box>
  );
}
