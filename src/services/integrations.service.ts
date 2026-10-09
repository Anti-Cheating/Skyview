/**
 * integrations.service — client wrapper for Cortex's /integrations/google/*
 * endpoints (Connect Google Calendar → generate Meet links).
 */
import { ApiService } from './api.service';

export interface GoogleConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
}

export interface GenerateMeetInput {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendeeEmails: string[];
  /** Update this existing calendar event instead of creating a new one. */
  existingEventId?: string;
}

export interface GeneratedMeet {
  meetUrl: string;
  eventId: string;
  htmlLink: string | null;
}

export class IntegrationsService {
  /** Current Google connection state for the settings UI. */
  static async googleStatus(): Promise<GoogleConnectionStatus> {
    const resp = await ApiService.get<GoogleConnectionStatus>('/integrations/google/status');
    return resp.data ?? { connected: false, accountEmail: null };
  }

  /**
   * Fetch the Google consent URL (auth header carried by ApiService). The
   * caller opens it in a popup so the create form it started from is never
   * navigated away / lost. `returnTo` is only used by the no-opener fallback.
   */
  static async getGoogleConsentUrl(returnTo?: string): Promise<string> {
    const back = returnTo ?? window.location.pathname + window.location.search;
    const resp = await ApiService.get<{ url: string }>(
      `/integrations/google/connect?returnTo=${encodeURIComponent(back)}`,
    );
    if (!resp.data?.url) throw new Error('Could not start Google connection');
    return resp.data.url;
  }

  static async disconnectGoogle(): Promise<void> {
    await ApiService.post('/integrations/google/disconnect');
  }

  /**
   * Generate a Meet link. Returns { ok, data } or a typed error so the
   * caller can distinguish "reconnect needed" (409) from a transient failure.
   */
  static async generateMeet(
    input: GenerateMeetInput,
  ): Promise<
    | { ok: true; data: GeneratedMeet }
    | { ok: false; reconnectRequired: boolean; error: string }
  > {
    try {
      const resp = await ApiService.post<GeneratedMeet>('/integrations/google/generate-meet', input);
      if (resp.data?.meetUrl) return { ok: true, data: resp.data };
      return { ok: false, reconnectRequired: false, error: 'No Meet link returned' };
    } catch (err: any) {
      const status = err?.status;
      return {
        ok: false,
        reconnectRequired: status === 409,
        error: err?.message || 'Could not generate a Meet link',
      };
    }
  }
}
