/**
 * profile.service.ts — wrapper for self-profile mutations.
 *
 * Currently a single call: PATCH /users/me. The matching read path is
 * GET /auth/me (already used by AuthContext) — no duplicate exposed
 * here. Email change is intentionally absent: it needs a verify-new-
 * email round trip we haven't built.
 */

import { ApiService } from './api.service';
import type { ApiResponse } from '../types/api.types';
import type { User } from '../types/auth.types';

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
}

export class ProfileService {
  /**
   * Update first / last name. Returns the refreshed user shape so
   * AuthContext can replace its cached user without a second read.
   */
  static async updateMe(input: UpdateProfileInput): Promise<ApiResponse<User>> {
    return ApiService.patch<User>('/users/me', input, undefined, 'auth');
  }
}
