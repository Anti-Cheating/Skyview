import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { InterviewSessionResponse, InterviewSession, InterviewType } from '../types/interview.types';
import { AuthService } from './auth.service';

export interface CreateInterviewParticipantInput {
  interviewer_email?: string;
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
  private static getUserId(): string | null {
    return AuthService.getCurrentUser()?.id || null;
  }

  static async getUpcomingInterviews(
    candidateId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const userId = candidateId || this.getUserId();
    if (!userId) throw new Error('User ID not found');

    const whereClause = {
      _and: [
        { interview_session_participants: { candidate_id: { _eq: userId } } },
        { scheduled_start_at: { _gt: 'now' } },
      ],
    };

    const encodedWhere = encodeURIComponent(JSON.stringify(whereClause));
    const endpoint = `/interview-sessions?where=${encodedWhere}&limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
  }

  static async getPastInterviews(
    candidateId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const userId = candidateId || this.getUserId();
    if (!userId) throw new Error('User ID not found');

    const whereClause = {
      _and: [
        { interview_session_participants: { candidate_id: { _eq: userId } } },
        { scheduled_start_at: { _lt: 'now' } },
      ],
    };

    const encodedWhere = encodeURIComponent(JSON.stringify(whereClause));
    const endpoint = `/interview-sessions?where=${encodedWhere}&limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
  }

  static async getUpcomingInterviewsForInterviewer(
    interviewerId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const userId = interviewerId || this.getUserId();
    if (!userId) throw new Error('User ID not found');

    const whereClause = {
      _and: [
        { interview_session_participants: { interviewer_id: { _eq: userId } } },
        { scheduled_start_at: { _gt: 'now' } },
      ],
    };

    const encodedWhere = encodeURIComponent(JSON.stringify(whereClause));
    const endpoint = `/interview-sessions?where=${encodedWhere}&limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
  }

  static async getPastInterviewsForInterviewer(
    interviewerId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<InterviewSession[]>> {
    const userId = interviewerId || this.getUserId();
    if (!userId) throw new Error('User ID not found');

    const whereClause = {
      _and: [
        { interview_session_participants: { interviewer_id: { _eq: userId } } },
        { scheduled_start_at: { _lt: 'now' } },
      ],
    };

    const encodedWhere = encodeURIComponent(JSON.stringify(whereClause));
    const endpoint = `/interview-sessions?where=${encodedWhere}&limit=${limit}&offset=${offset}`;
    const response = await ApiService.get<InterviewSessionResponse | InterviewSession[]>(endpoint, undefined, 'auth');

    let interviews: InterviewSession[] = [];
    if (Array.isArray(response.data)) {
      interviews = response.data;
    } else if (response.data?.interview_sessions) {
      interviews = response.data.interview_sessions;
    }

    return { success: response.success, data: interviews, message: response.message };
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
      status: input.status ?? 'scheduled',
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
}
