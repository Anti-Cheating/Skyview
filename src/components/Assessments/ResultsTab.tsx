import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { MdCheck, MdVideoCall } from 'react-icons/md';
import dayjs from 'dayjs';
import { AssessmentService } from '../../services/assessment.service';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useAuth } from '../../contexts/AuthContext';
import { isCompanyManagerRole } from '../../config/constants';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { SearchField } from '../common/SearchField';
import { StatusTag } from '../common/StatusTag';
import { Caption, Secondary } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentResultDetail, AssessmentResultRow, Integrity } from '../../types/assessment.types';
import { AssignTakeHome } from './AssignTakeHome';

export const fullName = (c: { first_name: string | null; last_name: string | null }) => [c.first_name, c.last_name].filter(Boolean).join(' ');

export function minutes(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m >= 1440) return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
  return m < 1 ? '< 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * How long the attempt took. Live: time on the questions. Take-home: start to
 * submit (the work happens off the page, in their repo).
 */
export function timeTaken(mode: Assessment['mode'], r: { time_ms: number; started_at: string | null; submitted_at: string | null }): number {
  if (mode !== 'take_home' || !r.started_at) return r.time_ms;
  return Math.max(0, Date.parse(r.submitted_at ?? new Date().toISOString()) - Date.parse(r.started_at));
}

/** /interviews/new prefilled with the candidate and a note of how they scored. */
export function createInterviewUrl(a: { title: string; role: string | null }, r: Pick<AssessmentResultRow, 'candidate' | 'final_score' | 'integrity'>) {
  const q = new URLSearchParams({
    first: r.candidate.first_name ?? '',
    last: r.candidate.last_name ?? '',
    email: r.candidate.email,
    role: a.role ?? '',
    description: `From assessment "${a.title}"${r.final_score != null ? ` · scored ${Math.round(r.final_score)}/100` : ''}${r.integrity.level === 'high' || r.integrity.level === 'review' ? ` · integrity: ${INTEGRITY_TAG[r.integrity.level].label}` : ''}`,
  });
  return `/interviews/new?${q.toString()}`;
}

/** Score with a small bar, coloured by band. */
export function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <Caption sx={{ color: TOKENS.textMuted }}>—</Caption>;
  const v = Math.round(value);
  const color = v >= 75 ? TOKENS.success : v >= 50 ? '#B45309' : TOKENS.error;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 56, height: 6, borderRadius: 3, bgcolor: TOKENS.borderLight, overflow: 'hidden' }}>
        <Box sx={{ width: `${v}%`, height: '100%', bgcolor: color }} />
      </Box>
      <Box sx={{ fontWeight: 700, color: TOKENS.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{v}</Box>
    </Box>
  );
}

const INTEGRITY_TAG: Record<Integrity['level'], { status: string; label: string }> = {
  clean: { status: 'COMPLETED', label: 'Clean' },
  review: { status: 'WARNING', label: 'Review' },
  high: { status: 'CANCELLED', label: 'High risk' },
  critical: { status: 'CRITICAL', label: 'Critical' },
  none: { status: 'SCHEDULED', label: 'No Helper' },
};

/** Why the score was cut, in words: shown under the score instead of the raw skill number. */
export const INTEGRITY_WHY: Partial<Record<Integrity['level'], string>> = {
  critical: 'Probable cheating',
  high: 'Possible cheating',
  review: 'Needs a review',
};

/** "Changed to Review by Asha · 25 Oct, 1:45 AM" */
export function changedText(c: NonNullable<Integrity['changed']>): string {
  const to = c.level ? `Changed to ${INTEGRITY_TAG[c.level].label}` : 'Reset to automatic';
  return `${to} by ${c.by} · ${dayjs(c.at).format('D MMM, h:mm A')}`;
}

function integrityTip(it: Integrity): string {
  if (it.report_status === 'pending') return 'Writing the Trueyy Helper report…';
  const why = it.summary ? it.summary : it.reasons.length ? it.reasons.map((r) => r.text).join(' · ') : it.level === 'none' ? 'Take-home: no Trueyy Helper. Only answer timing is checked.' : 'Nothing flagged';
  return it.changed ? `${why}. ${changedText(it.changed)}` : why;
}

/** Clean / Review / High risk, with the reasons on hover. `menu` adds a ▾ (it opens a picker). */
export function IntegrityTag({ it, menu }: { it: Integrity; menu?: boolean }) {
  const t = it.report_status === 'pending' && !it.overridden ? { status: 'SCHEDULED', label: 'Checking…' } : INTEGRITY_TAG[it.level];
  return (
    <Tooltip title={integrityTip(it)}>
      <Box component="span" sx={{ display: 'inline-flex' }}><StatusTag status={t.status} label={menu ? `${t.label} ▾` : t.label} /></Box>
    </Tooltip>
  );
}

/**
 * The integrity tag as a dropdown: staff can set Clean / Review / High risk
 * by hand, or go back to Automatic. Resolves with the updated result.
 */
export function IntegrityPicker({ assessmentId, attemptId, it, onChanged }: {
  assessmentId: string; attemptId: string; it: Integrity; onChanged: (d: AssessmentResultDetail) => void;
}) {
  const { showError, showSuccess } = useSnackbar();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const pick = async (level: 'clean' | 'review' | 'high' | 'critical' | null) => {
    setAnchor(null);
    if ((level ?? null) === (it.overridden ? it.level : null)) return;
    setSaving(true);
    try {
      const r = await AssessmentService.setIntegrity(assessmentId, attemptId, level);
      if (r.data) { onChanged(r.data); showSuccess(level ? `Integrity set to ${INTEGRITY_TAG[level].label}` : 'Integrity back to automatic'); }
    } catch (e: any) {
      showError(e?.message || 'Could not change integrity');
    } finally {
      setSaving(false);
    }
  };
  const options: Array<{ level: 'clean' | 'review' | 'high' | 'critical' | null; label: string; hint?: string }> = [
    { level: null, label: 'Automatic', hint: 'From the signals' },
    { level: 'clean', label: 'Clean', hint: 'Score × 1' },
    { level: 'review', label: 'Review', hint: 'Score × 0.85' },
    { level: 'high', label: 'High risk', hint: 'Score × 0.5' },
    { level: 'critical', label: 'Critical', hint: 'Score = 0' },
  ];
  const current = it.overridden ? it.level : null;
  return (
    <>
      <Box component="button" type="button" aria-haspopup="menu" aria-label={`Integrity: ${INTEGRITY_TAG[it.level].label}. Change`}
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }} disabled={saving}
        sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5, borderRadius: '6px', opacity: saving ? 0.6 : 1, '&:focus-visible': { outline: `2px solid ${TOKENS.brand}` } }}>
        <IntegrityTag it={it} menu />
        {saving && <CircularProgress size={12} sx={{ color: TOKENS.brand }} />}
      </Box>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()} PaperProps={{ sx: { borderRadius: '12px', minWidth: 260, py: 0.5 } }}>
        {/* ClickUp-style: each option is its own coloured tag, hint on the right. */}
        {options.map((o) => {
          const tag = INTEGRITY_TAG[o.level ?? it.auto_level];
          return (
            <MenuItem key={o.label} onClick={() => pick(o.level)} selected={current === o.level} sx={{ gap: 1, py: 0.75 }}>
              <Box sx={{ width: 18, display: 'flex', color: TOKENS.success }}>{current === o.level && <MdCheck />}</Box>
              <Box sx={{ minWidth: 96, display: 'flex' }}><StatusTag status={tag.status} label={o.level ? tag.label : `Auto · ${tag.label}`} /></Box>
              <Caption sx={{ color: TOKENS.textMuted, ml: 'auto', pl: 1.5, whiteSpace: 'nowrap' }}>{o.hint}</Caption>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export function gradingTag(r: Pick<AssessmentResultRow, 'status' | 'grading_status' | 'integrity'>) {
  if (r.status === 'started') return <StatusTag status="IN_PROGRESS" label="In progress" />;
  if (r.grading_status === 'done' && r.integrity.report_status === 'pending') return <StatusTag status="SCHEDULED" label="Writing report…" />;
  if (r.grading_status === 'done') return <StatusTag status="COMPLETED" label="Scored" />;
  if (r.grading_status === 'failed') return <StatusTag status="WARNING" label="Grading failed" />;
  return <StatusTag status="SCHEDULED" label="Grading…" />;
}

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);

/** Finalized assessment → candidates ranked by score. */
export function ResultsTab({ a }: { a: Assessment }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useSnackbar();
  const [rows, setRows] = useState<AssessmentResultRow[] | null>(null);
  const [version, setVersion] = useState(0); // bump to reload (e.g. after an integrity change re-ranks)
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Poll while anything is still being taken or graded.
  const busy = (rows ?? []).some((r) => r.status === 'started' || r.grading_status === 'pending' || r.grading_status === null || r.integrity.report_status === 'pending');
  useEffect(() => {
    let live = true;
    const load = () => AssessmentService.results(a.id)
      .then((r) => live && setRows(r.data ?? []))
      .catch((e) => { if (live) { showError(e?.message || 'Could not load results'); setRows([]); } });
    load();
    if (!busy && rows !== null) return () => { live = false; };
    const t = setInterval(load, 5000);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, busy, showError, version]);

  const canInterview = isCompanyManagerRole(user?.role);
  const columns = useMemo<DataTableColumn<AssessmentResultRow>[]>(() => ([
    { key: 'rank', header: '#', width: 40, render: (_r, i) => <Box sx={{ color: TOKENS.textSecondary, fontWeight: 600 }}>{(page - 1) * pageSize + i + 1}</Box> },
    {
      key: 'candidate',
      header: 'Candidate',
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: TOKENS.textPrimary }}>{fullName(r.candidate) || r.candidate.email}</Box>
          {fullName(r.candidate) && <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>{r.candidate.email}</Caption>}
        </Box>
      ),
    },
    {
      key: 'score', header: 'Score', width: 120,
      // Until it's scored (taking, grading, writing the report) the status sits here instead.
      render: (r) => r.final_score == null && !(r.grading_status === 'done' && r.integrity.report_status !== 'pending') ? gradingTag(r) : (
        <Box>
          <ScoreBar value={r.final_score} />
          {r.score != null && INTEGRITY_WHY[r.integrity.level] && (
            <Caption sx={{ color: r.integrity.level === 'review' ? '#92400E' : '#B91C1C', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {INTEGRITY_WHY[r.integrity.level]}
            </Caption>
          )}
        </Box>
      ),
    },
    {
      key: 'integrity', header: 'Integrity', width: 130,
      render: (r) => r.status === 'submitted'
        ? <IntegrityPicker assessmentId={a.id} attemptId={r.id} it={r.integrity} onChanged={() => setVersion((v) => v + 1)} />
        : <IntegrityTag it={r.integrity} />,
    },
    {
      key: 'parts', header: 'Reasoning · Accuracy', width: 150, hideOn: 'mobile',
      render: (r) => <Box sx={{ color: TOKENS.textSecondary, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{pct(r.reasoning)} · {pct(r.accuracy)}</Box>,
    },
    { key: 'time', header: 'Time', width: 90, hideOn: 'mobile', render: (r) => <Box sx={{ color: TOKENS.textSecondary, whiteSpace: 'nowrap' }}>{minutes(timeTaken(a.mode, r))}</Box> },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 130,
      hideOn: 'mobile',
      render: (r) => <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{r.submitted_at ? dayjs(r.submitted_at).format('D MMM, h:mm A') : '—'}</Caption>,
    },
    {
      key: 'actions',
      header: '',
      width: 84,
      align: 'right',
      render: (r) => r.status === 'submitted' ? (
        <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-flex' }}>
          {a.mode !== 'take_home' && <AssignTakeHome candidate={r.candidate} excludeId={a.id} />}
          {canInterview && <Tooltip title="Create interview">
            <IconButton size="small" aria-label="Create interview" onClick={() => navigate(createInterviewUrl(a, r))}
              sx={{ color: TOKENS.textSecondary, '&:hover': { color: TOKENS.success } }}>
              <MdVideoCall />
            </IconButton>
          </Tooltip>}
        </Box>
      ) : null,
    },
  // Take-home has no Trueyy Helper, so there's no integrity to show.
  ] satisfies DataTableColumn<AssessmentResultRow>[]).filter((c) => !(a.mode === 'take_home' && c.key === 'integrity')), [a, canInterview, navigate, page, pageSize]);

  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((r) => !q || r.candidate.email.toLowerCase().includes(q) || fullName(r.candidate).toLowerCase().includes(q));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: { md: 'auto' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
        <Secondary sx={{ color: TOKENS.textSecondary }}>
          Ranked by score: 70% reasoning, 30% accuracy, then adjusted for integrity (Review ×0.85, High risk ×0.5, Critical ×0).
        </Secondary>
        {busy && rows && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={14} sx={{ color: TOKENS.brand }} /><Caption sx={{ color: TOKENS.textSecondary }}>Updating…</Caption></Box>}
      </Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <SearchField placeholder="Search candidate or email" value={search} onChange={(v) => { setPage(1); setSearch(v); }} />
      </Box>
      <DataTable<AssessmentResultRow>
        columns={columns}
        rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
        rowKey={(r) => r.id}
        onRowClick={(r) => r.status === 'submitted' && navigate(`/assessments/${a.id}/results/${r.id}`)}
        loading={rows === null}
        emptyText={q ? 'No candidates match your search.' : 'No results yet. They appear here as candidates submit.'}
        pagination={{ page, pageSize, total: filtered.length, onChange: (p, sz) => { setPage(p); setPageSize(sz); } }}
      />
    </Box>
  );
}
