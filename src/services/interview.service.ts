import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { InterviewSessionResponse, InterviewSession, InterviewType } from '../types/interview.types';

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
  interview_type: InterviewType;
  // Required when interview_type === "application"
  provider?: string | null;
  // Required when interview_type === "extension"
  meeting_link?: string | null;
  interview_session_participants: CreateInterviewParticipantInput[];
}

export class InterviewService {
  /**
   * List upcoming sessions visible to the caller. The server decides WHO
   * the caller is (from the JWT) and which sessions they may see — the
   * client never sends a user ID or filter. Works for both candidate and
   * interviewer roles.
   */
  static async getUpcoming(
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const endpoint = `/interview-sessions/upcoming?limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
  }

  /**
   * List past sessions visible to the caller. Same access rules as
   * getUpcoming — JWT-driven on the server.
   */
  static async getPast(
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const endpoint = `/interview-sessions/past?limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
  }

  /**
   * Lightweight counts for the dashboard. Avoids fetching full session
   * objects just to read `.length`.
   */
  static async getCounts(): Promise<ApiResponse<{ upcoming: number; past: number }>> {
    const response = await ApiService.get<{ upcoming: number; past: number }>(
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
    // Strip fields that don't apply to the chosen interview_type so the
    // backend's superRefine validation doesn't reject the payload.
    const payload: Record<string, unknown> = {
      title: input.title,
      description: input.description ?? null,
      scheduled_start_at: input.scheduled_start_at,
      scheduled_end_at: input.scheduled_end_at,
      // Canonical uppercase vocabulary — matches Cortex's sessionGuard
      // and the session_lifecycle migration (SCHEDULED → ACTIVE → ENDED).
      status: input.status ?? 'SCHEDULED',
      timezone: input.timezone,
      interview_type: input.interview_type,
      interview_session_participants: input.interview_session_participants,
    };

    if (input.interview_type === 'extension') {
      payload.meeting_link = input.meeting_link;
    } else {
      payload.provider = input.provider;
    }

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
}
