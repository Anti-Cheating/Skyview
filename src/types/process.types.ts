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
}

export interface ProcessListItem {
  id: string;
  role: string;
  candidate: ProcessCandidate;
  rounds_total: number;
  rounds_done: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  updated_at: string;
}

export interface ProcessDetail {
  id: string;
  role: string;
  description: string | null;
  candidate: ProcessCandidate;
  created_at: string;
  created_by_name: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  rounds: RoundSummary[];
}

export interface RoundInput {
  round_name: string;
  interviewer_user_id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  timezone: string;
  meeting_link: string;
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
