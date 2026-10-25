import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { CandidateAttempt, MyAssessment } from '../types/assessment.types';

/**
 * Candidate assessment API. `base` is `/a/<emailed token>` (no login) or
 * `/me/assessments/<attempt id>` (logged-in candidate); the calls are the same.
 */
export class CandidateAssessmentService {
  static mine(): Promise<ApiResponse<MyAssessment[]>> {
    return ApiService.get<MyAssessment[]>('/me/assessments', undefined, 'auth');
  }

  static get(base: string): Promise<ApiResponse<CandidateAttempt>> {
    return ApiService.get<CandidateAttempt>(base, undefined, 'auth');
  }

  static start(base: string): Promise<ApiResponse<CandidateAttempt>> {
    return ApiService.post<CandidateAttempt>(`${base}/start`, {}, undefined, 'auth');
  }

  /** `timeMs` = this candidate's running total on the question. */
  static save(
    base: string,
    questionId: string,
    answer: number | string | null,
    explanation: string | null,
    timeMs: number,
    deliverableFiles?: Array<{ name: string; url?: string; content?: string; size?: number; type?: string }> | null
  ): Promise<ApiResponse<{ saved_at: string }>> {
    return ApiService.put<{ saved_at: string }>(
      `${base}/answers/${questionId}`,
      { answer, explanation, time_ms: Math.round(timeMs), ...(deliverableFiles ? { deliverable_files: deliverableFiles } : {}) },
      undefined,
      'auth'
    );
  }

  /** Live: trade the emailed link for a candidate login (the Trueyy Helper needs a user token). */
  static exchange(token: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: string }; attempt_id: string }>> {
    return ApiService.post(`/a/${token}/exchange`, {}, undefined, 'auth');
  }

  static submit(base: string): Promise<ApiResponse<CandidateAttempt>> {
    return ApiService.post<CandidateAttempt>(`${base}/submit`, {}, undefined, 'auth');
  }
}
