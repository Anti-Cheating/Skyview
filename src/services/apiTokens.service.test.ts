import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { ApiTokensService } from './apiTokens.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApiTokensService', () => {
  test('list unwraps the tokens array', async () => {
    get.mockResolvedValue({ success: true, data: { tokens: [{ id: 't1' }] } });
    const tokens = await ApiTokensService.list();
    expect(get).toHaveBeenCalledWith('/api/companies/me/api-tokens');
    expect(tokens).toEqual([{ id: 't1' }]);
  });

  test('list returns [] when data is missing', async () => {
    get.mockResolvedValue({ success: true, data: undefined });
    expect(await ApiTokensService.list()).toEqual([]);
  });

  test('create posts the input and returns the created token', async () => {
    const created = { id: 't1', plaintext: 'sk_live_x' };
    post.mockResolvedValue({ success: true, data: created });
    const input = { label: 'CI', environment: 'live' as const };
    const res = await ApiTokensService.create(input);
    expect(post).toHaveBeenCalledWith('/api/companies/me/api-tokens', input);
    expect(res).toBe(created);
  });

  test('create throws on an empty response', async () => {
    post.mockResolvedValue({ success: true, data: undefined });
    await expect(ApiTokensService.create({ label: 'x', environment: 'test' })).rejects.toThrow(
      /Empty response/,
    );
  });

  test('revoke deletes by id', async () => {
    del.mockResolvedValue({ success: true });
    await ApiTokensService.revoke('t9');
    expect(del).toHaveBeenCalledWith('/api/companies/me/api-tokens/t9');
  });
});
