// Multi-round interview process ("Interview" in the UI; rounds are its children).

export interface ProcessCandidate {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface RoundSummary {
  id: string;
  round_name: string | null;
  round_order: number | null;
  status: string; // SCHEDULED | ACTIVE | COMPLETED | CANCELLED
  scheduled_start_at: string;
  scheduled_end_at: string;
  interviewer: { first_name: string; last_name: string } | null;
  analysis: { overall_score: number | null; risk_level: string | null } | null;
  /** "assessment" = a test step: no interviewer; it opens the test's result. */
  kind?: 'interview' | 'assessment';
  assessment?: { id: string; title: string; mode: 'live' | 'take_home' } | null;
  result?: { id: string; score: number | null; grading_status: string | null } | null;
}

/** Where a test step opens: its result once submitted, else the test itself. */
export const testStepUrl = (r: RoundSummary): string | null =>
  r.kind === 'assessment' && r.assessment
    ? r.status === 'COMPLETED' && r.result ? `/assessments/${r.assessment.id}/results/${r.result.id}` : `/assessments/${r.assessment.id}`
    : null;

export interface ProcessListItem {
  id: string;
  role: string;
  candidate: ProcessCandidate;
  rounds_total: number;
  rounds_done: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED';
  updated_at: string;
}

export interface ProcessDetail {
  id: string;
  role: string;
  description: string | null;
  candidate: ProcessCandidate;
  created_at: string;
  created_by_name: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED';
  rounds: RoundSummary[];
}

export interface RoundInput {
  round_name: string;
  /** Team members taking this round — one participant row each. */
  interviewer_user_ids: string[];
  scheduled_start_at: string;
  scheduled_end_at: string;
  timezone: string;
  /** Pasted link; omit when generate_meet asks the backend to mint a Meet link. */
  meeting_link?: string;
  generate_meet?: boolean;
}

export interface CreateProcessInput {
  role: string;
  description?: string | null;
  candidate_email: string;
  candidate_first_name: string;
  candidate_last_name: string;
  first_round: RoundInput;
}

export interface UpdateProcessInput {
  role?: string;
  description?: string | null;
  candidate_first_name?: string;
  candidate_last_name?: string;
}
