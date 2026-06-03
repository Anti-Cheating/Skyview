import { ApiService } from './api.service';

export interface ApiToken {
  id: string;
  prefix: string;
  label: string;
  environment: 'live' | 'test';
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface CreatedApiToken extends ApiToken {
  plaintext: string; // shown ONCE
}

export const ApiTokensService = {
  async list(): Promise<ApiToken[]> {
    const res = await ApiService.get<{ tokens: ApiToken[] }>('/api/companies/me/api-tokens');
    return res.data?.tokens ?? [];
  },

  async create(input: { label: string; environment: 'live' | 'test'; expires_at?: string }): Promise<CreatedApiToken> {
    const res = await ApiService.post<CreatedApiToken>('/api/companies/me/api-tokens', input);
    if (!res.data) throw new Error('Empty response from /api-tokens');
    return res.data;
  },

  async revoke(id: string): Promise<void> {
    await ApiService.delete(`/api/companies/me/api-tokens/${id}`);
  },
};
