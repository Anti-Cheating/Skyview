/**
 * sessionJoin.service.ts — client wrapper for Cortex's public
 * /interview-sessions/join-token/exchange endpoint (candidate magic-link).
 *
 * Public — no JWT — mirrors invites.service.ts's bypass-ApiService
 * pattern since the candidate has no session yet.
 */

import { ENV } from '../config/env';

export interface JoinTokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

export class SessionJoinService {
  /** POST /interview-sessions/join-token/exchange */
  static async exchangeJoinToken(
    sessionId: string,
    token: string
  ): Promise<{ ok: true; data: JoinTokenExchangeResult } | { ok: false; error: string }> {
    try {
      const resp = await fetch(`${ENV.AUTH_API_URL}/interview-sessions/join-token/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { ok: false, error: payload?.error || 'Failed to join interview' };
      }
      return { ok: true, data: payload.data as JoinTokenExchangeResult };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  }
}
