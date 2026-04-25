/**
 * invites.service.ts — client wrapper for Cortex's /companies/:id/invites
 * and /invites/:token endpoints.
 *
 * Mirrors the shape the backend returns. Every call goes through
 * ApiService so the 401 → auto-refresh → retry behaviour applies,
 * except acceptInvite() which intentionally bypasses the auth header
 * because the invitee may not yet have a session.
 */

import { ApiService } from './api.service';
import { ENV } from '../config/env';
import type { ApiResponse } from '../types/api.types';

export type InviteRole = 'Admin' | 'Member';

export interface PendingInvite {
  id: string;
  email: string;
  role: InviteRole;
  expires_at: string;
  created_at: string;
  inviter: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface CreateInviteResult {
  id: string;
  email: string;
  role: InviteRole;
  expires_at: string;
  invite_url: string;
  email_sent: boolean;
}

export interface InvitePublicMeta {
  email: string;
  role: InviteRole;
  company_name: string | null;
  invited_by_name: string | null;
  expires_at: string;
  email_already_registered: boolean;
}

export interface AcceptInviteBody {
  first_name?: string;
  last_name?: string;
  password?: string;
}

export interface AcceptInviteResult {
  user: { id: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
}

export interface TeamMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  joined_at: string;
}

export class InvitesService {
  /** POST /companies/:id/invites */
  static async create(
    companyId: string,
    body: { email: string; role: InviteRole }
  ): Promise<ApiResponse<CreateInviteResult>> {
    return ApiService.post<CreateInviteResult>(
      `/companies/${companyId}/invites`,
      body,
      undefined,
      'auth'
    );
  }

  /**
   * GET /companies/:id/members
   *
   * Server-paginated. Pass `page` (1-based) + `pageSize` and the server
   * returns `{ items, total, page, pageSize }`. Optional `search`
   * matches name OR email server-side.
   */
  static async listMembers(
    companyId: string,
    opts: { page?: number; pageSize?: number; search?: string } = {}
  ): Promise<ApiResponse<{ items: TeamMember[]; total: number; page: number; pageSize: number }>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.max(1, Math.min(opts.pageSize ?? 10, 100));
    const offset = (page - 1) * pageSize;
    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('offset', String(offset));
    if (opts.search?.trim()) qs.set('search', opts.search.trim());
    return ApiService.get<{ items: TeamMember[]; total: number; page: number; pageSize: number }>(
      `/companies/${companyId}/members?${qs.toString()}`,
      undefined,
      'auth'
    );
  }

  /** GET /companies/:id/invites — same pagination shape as listMembers. */
  static async list(
    companyId: string,
    opts: { page?: number; pageSize?: number; search?: string } = {}
  ): Promise<ApiResponse<{ items: PendingInvite[]; total: number; page: number; pageSize: number }>> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.max(1, Math.min(opts.pageSize ?? 10, 100));
    const offset = (page - 1) * pageSize;
    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('offset', String(offset));
    if (opts.search?.trim()) qs.set('search', opts.search.trim());
    return ApiService.get<{ items: PendingInvite[]; total: number; page: number; pageSize: number }>(
      `/companies/${companyId}/invites?${qs.toString()}`,
      undefined,
      'auth'
    );
  }

  /** DELETE /invites/:id */
  static async revoke(inviteId: string): Promise<ApiResponse<unknown>> {
    return ApiService.delete(`/invites/${inviteId}`, undefined, 'auth');
  }

  /** POST /invites/:id/resend */
  static async resend(inviteId: string): Promise<ApiResponse<unknown>> {
    return ApiService.post(`/invites/${inviteId}/resend`, undefined, undefined, 'auth');
  }

  /**
   * GET /invites/:token — public; no JWT. We bypass ApiService's auto-
   * attach-auth-header logic because the invitee may be unauthenticated.
   */
  static async getPublic(token: string): Promise<InvitePublicMeta | null> {
    try {
      const resp = await fetch(`${ENV.AUTH_API_URL}/invites/${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) return null;
      const body = await resp.json();
      return (body?.data ?? null) as InvitePublicMeta | null;
    } catch {
      return null;
    }
  }

  /**
   * POST /invites/:token/accept — also public; the response contains
   * fresh access + refresh tokens so the caller is logged in as the new
   * user immediately.
   */
  static async accept(
    token: string,
    body: AcceptInviteBody
  ): Promise<{ ok: true; data: AcceptInviteResult } | { ok: false; error: string }> {
    try {
      const resp = await fetch(`${ENV.AUTH_API_URL}/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { ok: false, error: payload?.error || 'Failed to accept invitation' };
      }
      return { ok: true, data: payload.data as AcceptInviteResult };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  }
}
