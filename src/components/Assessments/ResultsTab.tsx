import { Box, Tooltip } from '@mui/material';
import { StatusTag } from '../common/StatusTag';
import { Caption } from '../layout/Typography';
import { TOKENS } from '../../theme';
import type { Assessment, AssessmentResultRow, Integrity } from '../../types/assessment.types';

// Result helpers shared by the Candidates tab and the result page.

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

function integrityTip(it: Integrity): string {
  if (it.report_status === 'pending') return 'Writing the Trueyy Helper report…';
  const why = it.summary ? it.summary : it.reasons.length ? it.reasons.map((r) => r.text).join(' · ') : it.level === 'none' ? 'Take-home: no Trueyy Helper. Only answer timing is checked.' : 'Nothing flagged';
  return why;
}

/** Clean / Review / High risk, with the reasons on hover. Automatic: staff add notes, they don't change it. */
export function IntegrityTag({ it }: { it: Integrity }) {
  const t = it.report_status === 'pending' ? { status: 'SCHEDULED', label: 'Checking…' } : INTEGRITY_TAG[it.level];
  return (
    <Tooltip title={integrityTip(it)}>
      <Box component="span" sx={{ display: 'inline-flex' }}><StatusTag status={t.status} label={t.label} /></Box>
    </Tooltip>
  );
}

export function gradingTag(r: Pick<AssessmentResultRow, 'status' | 'grading_status' | 'integrity'>) {
  if (r.status === 'started') return <StatusTag status="IN_PROGRESS" label="In progress" />;
  if (r.grading_status === 'done' && r.integrity.report_status === 'pending') return <StatusTag status="SCHEDULED" label="Writing report…" />;
  if (r.grading_status === 'done') return <StatusTag status="COMPLETED" label="Scored" />;
  if (r.grading_status === 'failed') return <StatusTag status="WARNING" label="Grading failed" />;
  return <StatusTag status="SCHEDULED" label="Grading…" />;
}
