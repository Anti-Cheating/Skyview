import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: { get: (...a: unknown[]) => get(...a) },
}));

import { CompanyAuditService } from './audit.service';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
});

describe('CompanyAuditService', () => {
  test('list with no query hits the base path', () => {
    CompanyAuditService.list();
    expect(get).toHaveBeenCalledWith('/api/companies/me/audit');
  });

  test('list serializes filters and drops empty values', () => {
    CompanyAuditService.list({ action: 'invite.create', search: '', limit: 20, offset: 0 });
    expect(get).toHaveBeenCalledWith(
      '/api/companies/me/audit?action=invite.create&limit=20&offset=0',
    );
  });

  test('detail builds the by-id path', () => {
    CompanyAuditService.detail('a1');
    expect(get).toHaveBeenCalledWith('/api/companies/me/audit/a1');
  });
});
