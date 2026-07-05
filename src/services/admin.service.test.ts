import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { AdminService } from './admin.service';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: {} });
  post.mockResolvedValue({ success: true, data: {} });
  patch.mockResolvedValue({ success: true, data: {} });
});

describe('AdminService', () => {
  test('dashboard hits the overview endpoint', () => {
    AdminService.dashboard();
    expect(get).toHaveBeenCalledWith('/admin/dashboard');
  });

  test('listCompanies serializes a query string, dropping empty values', () => {
    AdminService.listCompanies({ q: 'acme', status: '', page: 2, blank: null });
    expect(get).toHaveBeenCalledWith('/admin/companies?q=acme&page=2');
  });

  test('listCompanies with no query omits the "?"', () => {
    AdminService.listCompanies();
    expect(get).toHaveBeenCalledWith('/admin/companies');
  });

  test('per-company reads build the right nested paths', () => {
    AdminService.getCompany('c1');
    AdminService.companyUsers('c1');
    AdminService.companyBilling('c1');
    AdminService.companyWebhooks('c1');
    AdminService.companySecurity('c1');
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/admin/companies/c1',
      '/admin/companies/c1/users',
      '/admin/companies/c1/billing',
      '/admin/companies/c1/webhooks',
      '/admin/companies/c1/security',
    ]);
  });

  test('suspendCompany posts with no body; adjustQuota posts the add delta', () => {
    AdminService.suspendCompany('c1');
    expect(post).toHaveBeenCalledWith('/admin/companies/c1/suspend');
    AdminService.adjustQuota('c1', 50);
    expect(post).toHaveBeenLastCalledWith('/admin/companies/c1/quota-adjust', { add: 50 });
  });

  test('issueLicense / onboardEnterprise post their bodies', () => {
    const lic = { company_id: 'c1', interviews: 100, expires_at: '2027-01-01' };
    AdminService.issueLicense(lic);
    expect(post).toHaveBeenCalledWith('/admin/licenses', lic);
    const onboard = { company_name: 'Acme', interviews: 100, expires_at: '2027-01-01' };
    AdminService.onboardEnterprise(onboard);
    expect(post).toHaveBeenLastCalledWith('/admin/licenses/onboard', onboard);
  });

  test('topupLicense embeds company in path and posts add', () => {
    AdminService.topupLicense('acme', 25);
    expect(post).toHaveBeenCalledWith('/admin/licenses/acme/topup', { add: 25 });
  });

  test('audit list + detail', () => {
    AdminService.audit({ action: 'login' });
    expect(get).toHaveBeenCalledWith('/admin/audit?action=login');
    AdminService.auditDetail('a1');
    expect(get).toHaveBeenLastCalledWith('/admin/audit/a1');
  });

  test('plan mutations use post + patch', () => {
    AdminService.createPlan({ name: 'Pro' });
    expect(post).toHaveBeenCalledWith('/admin/plans', { name: 'Pro' });
    AdminService.updatePlan('p1', { price: 10 });
    expect(patch).toHaveBeenCalledWith('/admin/plans/p1', { price: 10 });
  });

  test('interview cloud reads', () => {
    AdminService.interview('s1');
    AdminService.interviewRaw('s1');
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/admin/interviews/s1',
      '/admin/interviews/s1/raw',
    ]);
  });
});
