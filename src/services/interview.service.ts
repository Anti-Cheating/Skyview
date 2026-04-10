import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { InterviewSessionResponse, InterviewSession } from '../types/interview.types';
import { AuthService } from './auth.service';

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
}
