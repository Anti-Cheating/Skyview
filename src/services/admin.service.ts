// Super Admin console API. Thin typed wrappers over ApiService (which adds the
// Bearer token + 401-retry). All endpoints are System-Admin-gated server-side.
import { ApiService } from './api.service';

const qs = (o: Record<string, unknown> = {}): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const AdminService = {
  // ── overview ──
  dashboard: () => ApiService.get('/admin/dashboard'),

  // ── companies ──
  listCompanies: (q: Record<string, unknown> = {}) => ApiService.get(`/admin/companies${qs(q)}`),
  getCompany: (id: string) => ApiService.get(`/admin/companies/${id}`),
  companyUsers: (id: string) => ApiService.get(`/admin/companies/${id}/users`),
  companyInvites: (id: string) => ApiService.get(`/admin/companies/${id}/invites`),
  companyApiTokens: (id: string) => ApiService.get(`/admin/companies/${id}/api-tokens`),
  companyBilling: (id: string) => ApiService.get(`/admin/companies/${id}/billing`),
  companyInterviews: (id: string) => ApiService.get(`/admin/companies/${id}/interviews`),
  companyWebhooks: (id: string) => ApiService.get(`/admin/companies/${id}/webhooks`),
  companySecurity: (id: string) => ApiService.get(`/admin/companies/${id}/security`),
  suspendCompany: (id: string) => ApiService.post(`/admin/companies/${id}/suspend`),
  adjustQuota: (id: string, add: number) => ApiService.post(`/admin/companies/${id}/quota-adjust`, { add }),

  // ── billing ──
  billingSummary: () => ApiService.get('/admin/billing/summary'),
  payments: (q: Record<string, unknown> = {}) => ApiService.get(`/admin/payments${qs(q)}`),

  // ── licensing ──
  licenses: () => ApiService.get('/admin/licenses'),
  issueLicense: (body: { company_id: string; interviews: number; expires_at: string; plan?: string }) => ApiService.post('/admin/licenses', body),
  onboardEnterprise: (body: { company_name: string; billing_email?: string; interviews: number; expires_at: string; plan?: string }) => ApiService.post('/admin/licenses/onboard', body),
  topupLicense: (company: string, add: number) => ApiService.post(`/admin/licenses/${company}/topup`, { add }),
  suspendLicense: (company: string) => ApiService.post(`/admin/licenses/${company}/suspend`),
  licenseToken: (company: string) => ApiService.get(`/admin/licenses/${company}/token`),
  licenseUsage: (company: string) => ApiService.get(`/admin/licenses/${company}/usage`),

  // ── ops / support / audit ──
  queues: () => ApiService.get('/admin/ops/queues'),
  webhooks: (q: Record<string, unknown> = {}) => ApiService.get(`/admin/webhooks${qs(q)}`),
  contactQueries: (q: Record<string, unknown> = {}) => ApiService.get(`/admin/contact-queries${qs(q)}`),
  audit: (q: Record<string, unknown> = {}) => ApiService.get(`/admin/audit${qs(q)}`),

  // ── interviews (cloud only) ──
  interview: (sid: string) => ApiService.get(`/admin/interviews/${sid}`),
  interviewRaw: (sid: string) => ApiService.get(`/admin/interviews/${sid}/raw`),

  // ── plans ──
  plans: () => ApiService.get('/admin/plans'),
  createPlan: (body: Record<string, unknown>) => ApiService.post('/admin/plans', body),
  updatePlan: (id: string, body: Record<string, unknown>) => ApiService.patch(`/admin/plans/${id}`, body),
};
