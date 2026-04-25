/**
 * companies.service.ts — read + rename a company.
 *
 * /companies/:id/members and /companies/:id/invites still live in
 * invites.service.ts (they're invite-domain reads, not company-row
 * reads). This service is only the row itself.
 */

import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';

export interface Company {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export class CompaniesService {
  static async getById(companyId: string): Promise<ApiResponse<Company>> {
    return ApiService.get<Company>(`/companies/${companyId}`, undefined, 'auth');
  }

  /** Owner-only at the server. */
  static async update(
    companyId: string,
    input: { name: string }
  ): Promise<ApiResponse<Company>> {
    return ApiService.patch<Company>(`/companies/${companyId}`, input, undefined, 'auth');
  }
}
