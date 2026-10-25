import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import { ENV } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type {
  ChatEvent,
  Assessment,
  AssessmentInvite,
  AssessmentResultDetail,
  AssessmentResultRow,
  AssessmentListItem,
  InviteCandidate,
  InviteResult,
  CreateAssessmentInput,
  QuestionPatch,
} from '../types/assessment.types';

const base = '/assessments';

/** Assessments builder API. Every mutation returns the full, updated assessment. */
export class AssessmentService {
  static list(): Promise<ApiResponse<AssessmentListItem[]>> {
    return ApiService.get<AssessmentListItem[]>(base, undefined, 'auth');
  }

  static get(id: string): Promise<ApiResponse<Assessment>> {
    return ApiService.get<Assessment>(`${base}/${id}`, undefined, 'auth');
  }

  static create(input: CreateAssessmentInput): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(base, input, undefined, 'auth');
  }

  /** One chat turn; the AI applies only the changes it describes in `reply`. */
  static chat(id: string, message: string): Promise<ApiResponse<{ reply: string; assessment: Assessment }>> {
    return ApiService.post(`${base}/${id}/chat`, { message }, undefined, 'auth');
  }

  /**
   * Same as chat(), but reports progress (plan, each question as it's
   * written, answer checks) through onEvent. Falls back to chat() when the
   * stream can't open (e.g. an expired token, which chat() refreshes).
   */
  static async chatStream(id: string, message: string, onEvent: (e: ChatEvent) => void): Promise<{ reply: string; assessment: Assessment }> {
    const r = await fetch(`${ENV.AUTH_API_URL}${base}/${id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ?? ''}` },
      body: JSON.stringify({ message }),
    }).catch(() => null);
    if (!r?.ok || !r.body || !(r.headers.get('Content-Type') ?? '').includes('ndjson')) {
      const res = await this.chat(id, message);
      if (!res.data) throw new Error(res.message || 'The AI could not build that. Please try again.');
      return res.data;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as ChatEvent | { type: 'done'; data: { reply: string; assessment: Assessment } } | { type: 'error'; error: string };
        if (e.type === 'done') return e.data;
        if (e.type === 'error') throw new Error(e.error);
        onEvent(e);
      }
    }
    throw new Error('The connection dropped before the AI finished. Please try again.');
  }

  static updateQuestion(id: string, qid: string, patch: QuestionPatch): Promise<ApiResponse<Assessment>> {
    return ApiService.patch<Assessment>(`${base}/${id}/questions/${qid}`, patch, undefined, 'auth');
  }

  /** Tell the AI what to change in one question (or only its rubric). */
  static aiEdit(id: string, qid: string, instruction: string, scope: 'question' | 'rubric' = 'question'): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(`${base}/${id}/questions/${qid}/ai-edit`, { instruction, scope }, undefined, 'auth');
  }

  static regenerate(id: string, qid: string): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(`${base}/${id}/questions/${qid}/regenerate`, {}, undefined, 'auth');
  }

  static acceptKey(id: string, qid: string): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(`${base}/${id}/questions/${qid}/accept-key`, {}, undefined, 'auth');
  }

  static deleteQuestion(id: string, qid: string): Promise<ApiResponse<Assessment>> {
    return ApiService.delete<Assessment>(`${base}/${id}/questions/${qid}`, undefined, 'auth');
  }

  static listInvites(id: string): Promise<ApiResponse<AssessmentInvite[]>> {
    return ApiService.get<AssessmentInvite[]>(`${base}/${id}/invites`, undefined, 'auth');
  }

  /** Live needs opensAt; take-home only closesAt (the start-by date). */
  static invite(id: string, candidates: InviteCandidate[], closesAt: string, opensAt?: string): Promise<ApiResponse<InviteResult>> {
    return ApiService.post<InviteResult>(`${base}/${id}/invites`, { candidates, opens_at: opensAt, closes_at: closesAt }, undefined, 'auth');
  }

  static resendInvite(id: string, aid: string): Promise<ApiResponse<AssessmentInvite[]>> {
    return ApiService.post<AssessmentInvite[]>(`${base}/${id}/invites/${aid}/resend`, {}, undefined, 'auth');
  }

  static revokeInvite(id: string, aid: string): Promise<ApiResponse<AssessmentInvite[]>> {
    return ApiService.delete<AssessmentInvite[]>(`${base}/${id}/invites/${aid}`, undefined, 'auth');
  }

  /** Read-only from then on; pending invites are revoked and emailed candidates told. */
  static cancel(id: string): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(`${base}/${id}/cancel`, {}, undefined, 'auth');
  }

  /** Candidates who started or submitted, best score first. */
  static results(id: string): Promise<ApiResponse<AssessmentResultRow[]>> {
    return ApiService.get<AssessmentResultRow[]>(`${base}/${id}/results`, undefined, 'auth');
  }

  static result(id: string, aid: string): Promise<ApiResponse<AssessmentResultDetail>> {
    return ApiService.get<AssessmentResultDetail>(`${base}/${id}/results/${aid}`, undefined, 'auth');
  }

  /** Override the integrity level (null = back to automatic). */
  static setIntegrity(id: string, aid: string, level: 'clean' | 'review' | 'high' | 'critical' | null): Promise<ApiResponse<AssessmentResultDetail>> {
    return ApiService.put<AssessmentResultDetail>(`${base}/${id}/results/${aid}/integrity`, { level }, undefined, 'auth');
  }

  static regrade(id: string, aid: string): Promise<ApiResponse<AssessmentResultDetail>> {
    return ApiService.post<AssessmentResultDetail>(`${base}/${id}/results/${aid}/regrade`, {}, undefined, 'auth');
  }

  static finalize(id: string): Promise<ApiResponse<Assessment>> {
    return ApiService.post<Assessment>(`${base}/${id}/finalize`, {}, undefined, 'auth');
  }
}
