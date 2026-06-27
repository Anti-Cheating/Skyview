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

  static async cancel(id: string): Promise<ApiResponse<unknown>> {
    const r = await ApiService.delete<unknown>(`/interview-processes/${id}`, undefined, 'auth');
    return { success: r.success, data: r.data, message: r.message };
  }
}
