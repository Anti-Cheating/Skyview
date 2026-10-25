// Company-scoped candidate directory (/api/companies/me/candidates).
// Owner/Admin only — powers the Candidates view (list + per-person detail).
import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';

const qs = (o: Record<string, unknown> = {}): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** One step on a candidate's timeline: an interview round or a test. `status` is the session status. */
export interface CandidateStep {
  id: string;
  process_id: string;
  role: string;
  kind: 'interview' | 'test' | 'assignment';
  name: string;
  status: string; // SCHEDULED | ACTIVE | COMPLETED | CANCELLED
  at: string;
}

export interface CandidateListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  steps: CandidateStep[];
  last_activity: string;
}

export interface CandidateTimelineStep extends CandidateStep {
  interviewer: string | null;
  /** Interview: analysis score once ready. */
  score: number | null;
  assessment_id: string | null;
  result: { id: string; grading_status: string | null } | null;
}

export interface CandidateDetail {
  candidate: { id: string; first_name: string; last_name: string; email: string };
  processes: { id: string; role: string }[];
  steps: CandidateTimelineStep[];
}

export interface CandidatesListQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export const CandidatesService = {
  list: (q: CandidatesListQuery = {}) =>
    ApiService.get<{ items: CandidateListItem[]; total: number }>(
      `/api/companies/me/candidates${qs(q as Record<string, unknown>)}`,
    ),
  get: (id: string): Promise<ApiResponse<CandidateDetail>> =>
    ApiService.get<CandidateDetail>(`/api/companies/me/candidates/${id}`),
  erase: (id: string): Promise<ApiResponse<{ receipt: { id: string; requested_at: string } }>> =>
    ApiService.delete<{ receipt: { id: string; requested_at: string } }>(`/api/companies/me/candidates/${id}`),
};
