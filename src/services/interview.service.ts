import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { InterviewSession } from '../types/interview.types';

export interface CreateInterviewParticipantInput {
  // Picked from a company-staff dropdown; backend validates the user
  // exists and belongs to the creator's company.
  interviewer_user_id?: string;
  candidate_email?: string;
  candidate_first_name?: string;
  candidate_last_name?: string;
}

export interface CreateInterviewInput {
  title: string;
  description?: string | null;
  scheduled_start_at: string;
  scheduled_end_at: string;
  status?: string;
  timezone: string;
  // The interviewer-supplied meeting URL (Zoom / Meet / Teams / …) —
  // Cortex parses the provider from it.
  meeting_link: string;
  // Multi-round: editable round label on the underlying session.
  round_name?: string;
  interview_session_participants: CreateInterviewParticipantInput[];
}

export type InterviewListPill = 'all' | 'scheduled' | 'completed';

export interface SessionsListResponse {
  items: InterviewSession[];
  total: number;
  counts: { all: number; scheduled: number; completed: number };
  page: number;
  pageSize: number;
}

export interface SessionsListFilter {
  status?: InterviewListPill;
  search?: string;
  page?: number;     // 1-based
  pageSize?: number;
}

export class InterviewService {
  /**
   * Unified list endpoint. Replaces the old getUpcoming/getPast pair +
   * the standalone counts route. Server takes status pill + search and
   * returns items, total, and pill counts in one shot — counts apply
   * the search filter but ignore the status filter so the pills always
   * show their accurate scope.
   */
  static async getSessions(filter: SessionsListFilter = {}): Promise<ApiResponse<SessionsListResponse>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.max(1, Math.min(filter.pageSize ?? 10, 100));
    const offset = (page - 1) * pageSize;

    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('offset', String(offset));
    if (filter.status && filter.status !== 'all') qs.set('status', filter.status);
    if (filter.search && filter.search.trim()) qs.set('search', filter.search.trim());

    const response = await ApiService.get<SessionsListResponse>(
      `/interview-sessions?${qs.toString()}`,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  /**
   * Lightweight counts-only call for the dashboard widget. Same shape
   * as the unified endpoint's `counts` field so the dashboard reads
   * one type regardless of which endpoint it called.
   */
  static async getCounts(): Promise<ApiResponse<{ all: number; scheduled: number; completed: number }>> {
    const response = await ApiService.get<{ all: number; scheduled: number; completed: number }>(
      '/interview-sessions/counts',
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  static async getById(sessionId: string): Promise<ApiResponse<InterviewSession>> {
    const response = await ApiService.get<InterviewSession>(
      `/interview-sessions/${sessionId}`,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  static async createInterview(
    input: CreateInterviewInput
  ): Promise<ApiResponse<InterviewSession>> {
    const payload: Record<string, unknown> = {
      title: input.title,
      description: input.description ?? null,
      scheduled_start_at: input.scheduled_start_at,
      scheduled_end_at: input.scheduled_end_at,
      // Canonical uppercase vocabulary — matches Cortex's sessionGuard
      // and the session_lifecycle migration (SCHEDULED → ACTIVE → COMPLETED).
      status: input.status ?? 'SCHEDULED',
      timezone: input.timezone,
      meeting_link: input.meeting_link,
      interview_session_participants: input.interview_session_participants,
    };

    const response = await ApiService.post<InterviewSession>(
      '/interview-sessions',
      payload,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  // Lifecycle transitions — the server is the single authority on session
  // state. SCHEDULED → ACTIVE on /activate, ACTIVE → ENDED on /deactivate,
  // and /heartbeat refreshes a Redis TTL so stale tabs get auto-ended if
  // the user closes without calling deactivate.
  static async activate(sessionId: string): Promise<ApiResponse<InterviewSession>> {
    const response = await ApiService.post<InterviewSession>(
      `/interview-sessions/${sessionId}/activate`,
      {},
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  static async deactivate(sessionId: string): Promise<ApiResponse<InterviewSession>> {
    const response = await ApiService.post<InterviewSession>(
      `/interview-sessions/${sessionId}/deactivate`,
      {},
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  /** Update an existing interview (Staff only — server enforces). */
  static async update(
    sessionId: string,
    input: Partial<CreateInterviewInput>
  ): Promise<ApiResponse<InterviewSession>> {
    const response = await ApiService.patch<InterviewSession>(
      `/interview-sessions/${sessionId}`,
      input,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  /** Delete an interview (Owner / Admin / System Admin only — server enforces). */
  static async remove(sessionId: string): Promise<ApiResponse<{ ok?: true }>> {
    const response = await ApiService.delete<{ ok?: true }>(
      `/interview-sessions/${sessionId}`,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  static async heartbeat(
    sessionId: string
  ): Promise<ApiResponse<{ status?: string }>> {
    const response = await ApiService.post<{ status?: string }>(
      `/interview-sessions/${sessionId}/heartbeat`,
      {},
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  /** Trigger post-interview analysis (async on Cortex). */
  static async triggerPostAnalysis(
    sessionId: string
  ): Promise<ApiResponse<{ status: string; message?: string }>> {
    const response = await ApiService.post<{ status: string; message?: string }>(
      `/interviews/${sessionId}/analyze`,
      {},
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }

  /** Fetch stored post-interview report from interview_analysis. */
  static async getPostAnalysis(sessionId: string): Promise<ApiResponse<Record<string, unknown>>> {
    const response = await ApiService.get<Record<string, unknown>>(
      `/interviews/${sessionId}/analysis`,
      undefined,
      'auth'
    );
    return { success: response.success, data: response.data, message: response.message };
  }
}
