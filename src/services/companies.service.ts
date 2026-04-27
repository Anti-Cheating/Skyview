/**
 * companies.service.ts — read + update + logo for a company.
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
  logo_url: string | null;
  website: string | null;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

// All fields optional — the server treats absent keys as "leave alone"
// and explicit null as "clear". Empty strings from the form are coerced
// to null server-side, so we send the user's input as-is.
export interface UpdateCompanyInput {
  name?: string;
  website?: string | null;
  description?: string | null;
  location?: string | null;
}

export class CompaniesService {
  static async getById(companyId: string): Promise<ApiResponse<Company>> {
    return ApiService.get<Company>(`/companies/${companyId}`, undefined, 'auth');
  }

  /** Owner-only at the server. */
  static async update(
    companyId: string,
    input: UpdateCompanyInput
  ): Promise<ApiResponse<Company>> {
    return ApiService.patch<Company>(`/companies/${companyId}`, input, undefined, 'auth');
  }

  /**
   * Multipart upload to POST /companies/:id/logo. The server uploads to
   * R2 (path company-logos/{companyId}/{uuid}.{ext}) and persists
   * logo_url on the company row, returning the updated company.
   */
  static async uploadLogo(
    companyId: string,
    file: File
  ): Promise<ApiResponse<Company>> {
    const fd = new FormData();
    fd.append('logo', file);
    return ApiService.post<Company>(`/companies/${companyId}/logo`, fd, undefined, 'auth');
  }

  /** Clears logo_url and deletes the R2 object. Owner-only at the server. */
  static async deleteLogo(companyId: string): Promise<ApiResponse<Company>> {
    return ApiService.delete<Company>(`/companies/${companyId}/logo`, undefined, 'auth');
  }
}
