import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type {
  ProcessListItem,
  ProcessDetail,
  CreateProcessInput,
  RoundInput,
  UpdateProcessInput,
} from '../types/process.types';

export interface ProcessListResponse {
  items: ProcessListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProcessListFilter {
  page?: number; // 1-based
  pageSize?: number;
  search?: string;
}

/** One Google Calendar event read into New-interview fields (Cortex calendarImport.ts). */
export interface CalendarDraft {
  event_id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  timezone: string;
  duration_minutes: number;
  meeting_link: string | null;
  interviewers: Array<{ id: string; name: string; email: string }>;
  candidates: Array<{ email: string; first_name?: string; last_name?: string }>;
  skipped: Array<{ email: string; reason: 'not_on_team' }>;
  status:
    | 'ready'
    | 'pick_candidate'
    | 'not_interview'
    | 'no_interviewer'
    | 'no_link'
    | 'already_imported'
    | 'candidate_not_invited';
  html_link: string | null;
}

export type CalendarImportResult =
  | { event_id: string; ok: true; process_id: string; round_id: string }
  | { event_id: string; ok: false; error: string };

/** Parent "Interview" (process) API — rounds are created/edited via InterviewService (sessions). */
export class ProcessService {
  static async list(filter: ProcessListFilter = {}): Promise<ApiResponse<ProcessListResponse>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.max(1, Math.min(filter.pageSize ?? 10, 100));
    const offset = (page - 1) * pageSize;

    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('offset', String(offset));
    if (filter.search && filter.search.trim()) qs.set('search', filter.search.trim());

    const r = await ApiService.get<ProcessListResponse>(
      `/interview-processes?${qs.toString()}`,
      undefined,
      'auth'
    );
    return { success: r.success, data: r.data, message: r.message };
  }

  static async getById(id: string): Promise<ApiResponse<ProcessDetail>> {
    const r = await ApiService.get<ProcessDetail>(`/interview-processes/${id}`, undefined, 'auth');
    return { success: r.success, data: r.data, message: r.message };
  }

  static async create(
    input: CreateProcessInput
  ): Promise<ApiResponse<{ id: string; round_id: string }>> {
    const r = await ApiService.post<{ id: string; round_id: string }>(
      `/interview-processes`,
      input,
      undefined,
      'auth'
    );
    return { success: r.success, data: r.data, message: r.message };
  }

  static async addRound(
    id: string,
    round: RoundInput
  ): Promise<ApiResponse<{ round_id: string; round_order: number }>> {
    const r = await ApiService.post<{ round_id: string; round_order: number }>(
      `/interview-processes/${id}/rounds`,
      round,
      undefined,
      'auth'
    );
    return { success: r.success, data: r.data, message: r.message };
  }

  static async update(id: string, patch: UpdateProcessInput): Promise<ApiResponse<unknown>> {
    const r = await ApiService.patch<unknown>(`/interview-processes/${id}`, patch, undefined, 'auth');
    return { success: r.success, data: r.data, message: r.message };
  }

  /**
   * Upcoming events on the caller's Google Calendar, each read into a draft.
   * With processId, only events inviting that interview's candidate qualify.
   */
  static async calendarEvents(
    days: number,
    processId?: string
  ): Promise<{ timezone: string | null; drafts: CalendarDraft[] }> {
    const r = await ApiService.get<{ timezone: string | null; drafts: CalendarDraft[] }>(
      `/interview-processes/calendar-events?days=${days}${processId ? `&process_id=${processId}` : ''}`,
      undefined,
      'auth'
    );
    return r.data ?? { timezone: null, drafts: [] };
  }

  /**
   * Import the chosen events; one result per event (some can fail while others
   * succeed). With processId they become the next rounds of that interview.
   */
  static async importCalendar(
    items: Array<{ event_id: string; role?: string; round_name?: string; candidate_email?: string }>,
    timezone: string | null,
    processId?: string
  ): Promise<CalendarImportResult[]> {
    const r = await ApiService.post<{ results: CalendarImportResult[] }>(
      `/interview-processes/import-calendar`,
      { items, ...(timezone ? { timezone } : {}), ...(processId ? { process_id: processId } : {}) },
      undefined,
      'auth'
    );
    return r.data?.results ?? [];
  }

  static async cancel(id: string): Promise<ApiResponse<unknown>> {
    const r = await ApiService.delete<unknown>(`/interview-processes/${id}`, undefined, 'auth');
    return { success: r.success, data: r.data, message: r.message };
  }

}
