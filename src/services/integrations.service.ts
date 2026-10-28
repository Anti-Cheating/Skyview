/**
 * integrations.service — client wrapper for Cortex's /integrations/google/*
 * endpoints (connect / status / disconnect). Meet links themselves are minted
 * by the backend when a round is saved with generate_meet.
 */
import { ApiService } from './api.service';

export interface GoogleConnectionStatus {
  connected: boolean;
  accountEmail: string | null;
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
}
