import { ApiService } from './api.service';

export type WebhookEventType =
  | '*'
  | 'session.ready'
  | 'session.transcript_segment'
  | 'session.risk_pulse'
  | 'session.window_result'
  | 'session.image_analysis_result'
  | 'session.ended'
  | 'session.report_ready'
  | 'session.cancelled';

export interface WebhookEndpoint {
  id: string;
  label: string;
  url: string;
  event_types: WebhookEventType[];
  status: 'active' | 'paused' | 'disabled_by_failures';
  last_delivery_at: string | null;
  consecutive_failures: number;
  created_at: string;
}

export interface CreatedWebhookEndpoint extends WebhookEndpoint {
  signing_secret: string; // shown ONCE
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  status: 'pending' | 'succeeded' | 'failed' | 'dead_lettered';
  http_status: number | null;
  attempt_count: number;
  created_at: string;
  delivered_at: string | null;
  next_retry_at: string | null;
  error_message: string | null;
}

export const WebhooksService = {
  async listEndpoints(): Promise<WebhookEndpoint[]> {
    const res = await ApiService.get<{ endpoints: WebhookEndpoint[] }>('/api/companies/me/webhook-endpoints');
    return res.data?.endpoints ?? [];
  },

  async createEndpoint(input: { label: string; url: string; event_types: WebhookEventType[] }): Promise<CreatedWebhookEndpoint> {
    const res = await ApiService.post<CreatedWebhookEndpoint>('/api/companies/me/webhook-endpoints', input);
    if (!res.data) throw new Error('Empty response from /webhook-endpoints');
    return res.data;
  },

  async updateEndpoint(id: string, input: Partial<{ label: string; url: string; event_types: WebhookEventType[]; status: 'active' | 'paused' }>): Promise<void> {
    await ApiService.patch(`/api/companies/me/webhook-endpoints/${id}`, input);
  },

  async revokeEndpoint(id: string): Promise<void> {
    await ApiService.delete(`/api/companies/me/webhook-endpoints/${id}`);
  },

  async rotateSecret(id: string): Promise<string> {
    const res = await ApiService.post<{ signing_secret: string }>(`/api/companies/me/webhook-endpoints/${id}/rotate-secret`);
    if (!res.data?.signing_secret) throw new Error('Empty response from rotate-secret');
    return res.data.signing_secret;
  },

  async listDeliveries(filter: { endpoint_id?: string; status?: WebhookDelivery['status']; limit?: number } = {}): Promise<WebhookDelivery[]> {
    const params = new URLSearchParams();
    if (filter.endpoint_id) params.set('endpoint_id', filter.endpoint_id);
    if (filter.status) params.set('status', filter.status);
    if (filter.limit) params.set('limit', String(filter.limit));
    const q = params.toString();
    const path = q ? `/api/companies/me/webhook-deliveries?${q}` : '/api/companies/me/webhook-deliveries';
    const res = await ApiService.get<{ deliveries: WebhookDelivery[] }>(path);
    return res.data?.deliveries ?? [];
  },

  async refireDelivery(id: string): Promise<void> {
    await ApiService.post(`/api/companies/me/webhook-deliveries/${id}/refire`);
  },
};
