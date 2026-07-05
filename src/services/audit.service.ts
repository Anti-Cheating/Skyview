// Company-scoped audit trail (/api/companies/me/audit). Owner/Admin only —
// the server hides platform-staff operations; customers see what their own
// people and API keys did.
import { ApiService } from './api.service';

const qs = (o: Record<string, unknown> = {}): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface AuditListItem {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  company_id: string | null;
  company_name?: string | null;
  created_at: string;
  // Legacy aliases still returned by /admin/audit
  user_id?: string | null;
  user_name?: string | null;
}

export interface AuditDetail extends AuditListItem {
  actor_email: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditListQuery {
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const CompanyAuditService = {
  list: (q: AuditListQuery = {}) =>
    ApiService.get<{ items: AuditListItem[]; total: number }>(`/api/companies/me/audit${qs(q as Record<string, unknown>)}`),
  detail: (id: string) =>
    ApiService.get<AuditDetail>(`/api/companies/me/audit/${id}`),
};
