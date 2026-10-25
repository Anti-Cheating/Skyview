import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { MdMoreHoriz, MdNotes, MdVideoCall } from 'react-icons/md';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useAuth } from '../../contexts/AuthContext';
import { isCompanyManagerRole } from '../../config/constants';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { StatusTag } from '../common/StatusTag';
import { useConfirm } from '../common/useConfirm';
import { Caption } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentInvite, AssessmentResultRow } from '../../types/assessment.types';
import { AssignTakeHome } from './AssignTakeHome';
import { INTEGRITY_WHY, IntegrityTag, createInterviewUrl, fullName, gradingTag } from './ResultsTab';

const fmt = (iso: string) => dayjs(iso).format('D MMM');

/** One person on this test: their invite, plus their result once they've started. */
type Row = { id: string; invite: AssessmentInvite; result: AssessmentResultRow | null };

function status(r: Row) {
  if (r.result) return gradingTag(r.result);
  const i = r.invite;
  if (i.status === 'revoked') return <StatusTag status="CANCELLED" label="Revoked" />;
  if (dayjs(i.closes_at).isBefore(dayjs())) return <StatusTag status="SCHEDULED" label="Expired" />;
  if (!i.invite_sent_at) return <StatusTag status="WARNING" label="Email not sent" />;
  return <StatusTag status="SCHEDULED" label="Invited" />;
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: `1px solid ${TOKENS.border}`, borderRadius: '14px', px: 2.25, py: 2 }}>
      <Box sx={{ fontSize: '1.5rem', fontWeight: 700, color: TOKENS.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</Box>
      <Caption sx={{ color: TOKENS.textSecondary }}>{label}</Caption>
    </Box>
  );
}

/** ⋯ on an open invite: send the link again, or take it back. */
function InviteMenu({ disabled, onResend, onRevoke }: { disabled: boolean; onResend: () => void; onRevoke: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (fn: () => void) => () => { setAnchor(null); fn(); };
  return (
    <>
      <IconButton size="small" aria-label="Invite options" disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: TOKENS.textSecondary }}>
        <MdMoreHoriz />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={pick(onResend)} sx={{ fontSize: '0.875rem' }}>Resend with a new link</MenuItem>
        <MenuItem onClick={pick(onRevoke)} sx={{ fontSize: '0.875rem', color: '#B91C1C' }}>Revoke invite</MenuItem>
      </Menu>
    </>
  );
}

/**
 * Finalized assessment → everyone invited, in one table: those who started or
 * submitted first, ranked by score, then the invites nobody has started yet.
 * Inviting happens on its own page.
 */
export function CandidatesTab({ a }: { a: Assessment }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const { confirm, dialog } = useConfirm();
  const [invites, setInvites] = useState<AssessmentInvite[] | null>(null);
  const [results, setResults] = useState<AssessmentResultRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const live = a.mode === 'live';
  // Live with the Helper on is the only kind with an integrity check.
  const monitored = live && a.helper_required !== false;
  const canInterview = isCompanyManagerRole(user?.role);

  useEffect(() => {
    AssessmentService.listInvites(a.id)
      .then((r) => setInvites(r.data ?? []))
      .catch((e) => { showError(e?.message || 'Could not load candidates'); setInvites([]); });
  }, [a.id, showError]);

  // Results poll while anything is still being taken or graded.
  const working = (results ?? []).some((r) => r.status === 'started' || r.grading_status === 'pending' || r.grading_status === null || r.integrity.report_status === 'pending');
  useEffect(() => {
    let on = true;
    const load = () => AssessmentService.results(a.id)
      .then((r) => on && setResults(r.data ?? []))
      .catch((e) => { if (on) { showError(e?.message || 'Could not load results'); setResults([]); } });
    load();
    if (!working && results !== null) return () => { on = false; };
    const t = setInterval(load, 5000);
    return () => { on = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, working, showError]);

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

  // Results come ranked from the server; everyone else follows, newest invite first.
  const rows = useMemo<Row[]>(() => {
    if (!invites || !results) return [];
    const byId = new Map(invites.map((i) => [i.id, i]));
    const ranked = results.flatMap((r) => {
      const invite = byId.get(r.id);
      return invite ? [{ id: r.id, invite, result: r }] : [];
    });
    const started = new Set(results.map((r) => r.id));
    return [...ranked, ...invites.filter((i) => !started.has(i.id)).map((invite) => ({ id: invite.id, invite, result: null }))];
  }, [invites, results]);

  const columns = useMemo<DataTableColumn<Row>[]>(() => ([
    {
      key: 'candidate', header: 'Candidate',
      render: (r) => {
        const c = r.invite.candidate, i = r.invite;
        const when = i.submitted_at ? `Submitted ${fmt(i.submitted_at)}`
          : i.status === 'started' && i.started_at ? `Started ${fmt(i.started_at)}`
          : `Invited ${fmt(i.created_at)}`;
        return (
          <Box sx={{ minWidth: 0 }}>
            <Tooltip title={fullName(c) ? c.email : ''} placement="top-start">
              <Box sx={{ fontSize: '0.875rem', fontWeight: 600, color: TOKENS.textPrimary, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {fullName(c) || c.email}
                {r.result?.has_note && <Box component="span" sx={{ display: 'inline-flex', color: TOKENS.textMuted }}><MdNotes aria-label="Has a note" /></Box>}
              </Box>
            </Tooltip>
            <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{when}</Caption>
          </Box>
        );
      },
    },
    { key: 'status', header: 'Status', width: 140, render: status },
    {
      key: 'score', header: 'Score', width: 130,
      render: (r) => {
        const x = r.result;
        if (!x || x.final_score == null) return <Caption sx={{ color: TOKENS.textMuted }}>—</Caption>;
        return (
          <Box>
            <Box sx={{ fontWeight: 700, color: TOKENS.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{Math.round(x.final_score)}</Box>
            {INTEGRITY_WHY[x.integrity.level] && (
              <Caption sx={{ color: x.integrity.level === 'review' ? '#92400E' : '#B91C1C', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {INTEGRITY_WHY[x.integrity.level]}
              </Caption>
            )}
          </Box>
        );
      },
    },
    {
      key: 'integrity', header: 'Integrity', width: 130,
      render: (r) => r.result ? <IntegrityTag it={r.result.integrity} /> : <Caption sx={{ color: TOKENS.textMuted }}>—</Caption>,
    },
    {
      key: 'actions', header: '', width: 84, align: 'right',
      render: (r) => {
        if (busy === r.id) return <CircularProgress size={16} sx={{ color: TOKENS.brand }} />;
        if (r.result?.status === 'submitted') {
          const x = r.result;
          return (
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-flex' }}>
              {a.mode !== 'take_home' && <AssignTakeHome candidate={x.candidate} excludeId={a.id} />}
              {canInterview && <Tooltip title="Create interview">
                <IconButton size="small" aria-label="Create interview" onClick={() => navigate(createInterviewUrl(a, x))}
                  sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.success } }}>
                  <MdVideoCall />
                </IconButton>
              </Tooltip>}
            </Box>
          );
        }
        const i = r.invite;
        if (r.result || a.status !== 'final' || i.status !== 'invited' || dayjs(i.closes_at).isBefore(dayjs())) return null;
        return (
          <Box sx={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
            <InviteMenu disabled={!!busy}
              onResend={() => act(i.id, () => AssessmentService.resendInvite(a.id, i.id), 'Invite sent again')}
              onRevoke={async () => {
                if (await confirm({ title: 'Revoke this invite?', body: `${i.candidate.email}'s link stops working. You can invite them again later.`, confirmLabel: 'Revoke invite', danger: true })) {
                  act(i.id, () => AssessmentService.revokeInvite(a.id, i.id), 'Invite revoked');
                }
              }} />
          </Box>
        );
      },
    },
  // Without the Trueyy Helper (take-home, or live with it off) there's no integrity to show.
  ] satisfies DataTableColumn<Row>[]).filter((c) => monitored || c.key !== 'integrity'), [a, act, busy, canInterview, confirm, monitored, navigate]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => !q || r.invite.candidate.email.toLowerCase().includes(q) || fullName(r.invite.candidate).toLowerCase().includes(q));
  const invited = (invites ?? []).filter((i) => i.status !== 'revoked').length;
  const done = (results ?? []).filter((r) => r.status === 'submitted');
  const scored = done.filter((r) => r.final_score != null);
  const avg = scored.length ? Math.round(scored.reduce((n, r) => n + r.final_score!, 0) / scored.length) : null;
  const flagged = done.filter((r) => r.integrity.level === 'review' || r.integrity.level === 'high' || r.integrity.level === 'critical').length;
  const loaded = invites !== null && results !== null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, overflowY: { md: 'auto' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5, flexShrink: 0 }}>
        {working && results && <CircularProgress size={14} sx={{ color: TOKENS.brand }} aria-label="Updating" />}
        <SearchField placeholder="Search" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${monitored ? 4 : 3}, minmax(0, 1fr))` }, gap: 1.5, flexShrink: 0 }}>
        <Stat value={loaded ? invited : '—'} label="Invited" />
        <Stat value={loaded ? done.length : '—'} label="Submitted" />
        <Stat value={avg ?? '—'} label="Average score" />
        {monitored && <Stat value={loaded ? flagged : '—'} label="Needs a look" />}
      </Box>

      <DataTable<Row>
        columns={columns}
        rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
        rowKey={(r) => r.id}
        onRowClick={(r) => r.result?.status === 'submitted' && navigate(`/assessments/${a.id}/results/${r.id}`)}
        loading={!loaded}
        emptyText={q ? 'No candidates match.' : 'No candidates yet.'}
        pagination={{ page, pageSize, total: filtered.length, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
      {dialog}
    </Box>
  );
}
