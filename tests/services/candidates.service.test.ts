import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const del = vi.fn();
vi.mock('../../src/services/api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { CandidatesService } from '../../src/services/candidates.service';

beforeEach(() => { get.mockReset(); del.mockReset(); });

describe('CandidatesService', () => {
  test('list builds the company-scoped query string', async () => {
    get.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    await CandidatesService.list({ search: 'priya', limit: 20, offset: 0 });
    expect(get).toHaveBeenCalledWith('/api/companies/me/candidates?search=priya&limit=20&offset=0');
  });

  test('get fetches one candidate', async () => {
    get.mockResolvedValue({ success: true, data: {} });
    await CandidatesService.get('c9');
    expect(get).toHaveBeenCalledWith('/api/companies/me/candidates/c9');
  });

  test('erase DELETEs the candidate', async () => {
    del.mockResolvedValue({ success: true, data: { receipt: { id: 'r1', requested_at: 'now' } } });
    const r = await CandidatesService.erase('c9');
    expect(del).toHaveBeenCalledWith('/api/companies/me/candidates/c9');
    expect(r.success).toBe(true);
  });
});
