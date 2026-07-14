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

export interface CandidateListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  interviews_count: number;
  rounds_count: number;
  last_activity: string;
}

export interface CandidateRound {
  id: string;
  round_name: string | null;
  round_order: number | null;
  status: string;
  scheduled_start_at: string;
  interviewer: { first_name: string; last_name: string } | null;
  analysis: { overall_score: number | null; risk_level: string | null } | null;
}

export interface CandidateInterview {
  process_id: string;
  role: string;
  created_at: string;
  rounds: CandidateRound[];
}

export interface CandidateDetail {
  candidate: { id: string; first_name: string; last_name: string; email: string };
  interviews: CandidateInterview[];
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
