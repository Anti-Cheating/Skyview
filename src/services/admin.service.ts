import { ApiService } from './api.service';

// ────── Tenant list ───────────────────────────────────────────────────────
export interface AdminTenantSummary {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  plan_limit: number;
  sessions_used_month: number;
  cap_policy: string;
  status: string;
  is_v2: boolean;
  created_at: string;
}

// ────── Tenant detail (overview tab) ──────────────────────────────────────
export interface AdminTenantDetail extends AdminTenantSummary {
  recent_migrations: AdminTenantMigration[];
  invoice_count: number;
}

// ────── Users tab ─────────────────────────────────────────────────────────
export interface AdminTenantUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  roles: string[];
  created_at: string;
}

// ────── Sessions tab ──────────────────────────────────────────────────────
export interface AdminTenantSessionParticipant {
  id: string;
  candidate: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  interviewer: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}
export interface AdminTenantSession {
  id: string;
  title: string;
  status: string;
  interview_type: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  ended_at: string | null;
  created_at: string;
  participants: AdminTenantSessionParticipant[];
}

// ────── API tokens tab ────────────────────────────────────────────────────
export interface AdminTenantApiToken {
  id: string;
  label: string;
  token_prefix: string;
  environment: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ────── Webhooks tab ──────────────────────────────────────────────────────
export interface AdminTenantWebhookEndpoint {
  id: string;
  label: string;
  url: string;
  event_types: string[];
  status: string;
  last_delivery_at: string | null;
  consecutive_failures: number;
  created_at: string;
}
export interface AdminTenantWebhookDelivery {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  http_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  delivered_at: string | null;
  created_at: string;
}

// ────── Invoices tab ──────────────────────────────────────────────────────
export interface AdminTenantInvoice {
  id: string;
  period: string;
  total_usd: string;
  status: string;
  due_at: string;
  sent_at: string | null;
  paid_at: string | null;
  paid_via: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  created_at: string;
}

// ────── Migrations tab ────────────────────────────────────────────────────
export interface AdminTenantMigration {
  id: string;
  kind: string;
  status: string;
  error_message: string | null;
  log_jsonl: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// ────── Audit log tab ─────────────────────────────────────────────────────
export interface AdminTenantAuditAction {
  id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ────── V2 hint wrapper ───────────────────────────────────────────────────
// Cortex returns `{ is_v2: true, <data>: [] }` for operational data slices
// of V2 tenants (the data lives in their own Postgres, not ours).
type V2Hint = { is_v2?: boolean };

export const AdminService = {
  listTenants: () =>
    ApiService.get<{ tenants: AdminTenantSummary[] }>('/control-plane/admin/tenants'),

  getTenant: (id: string) =>
    ApiService.get<AdminTenantDetail>(`/control-plane/admin/tenants/${id}`),

  suspend: (id: string, reason?: string) =>
    ApiService.post(`/control-plane/admin/tenants/${id}/suspend`, { reason }),
  resume: (id: string) =>
    ApiService.post(`/control-plane/admin/tenants/${id}/resume`),

  markPaid: (
    invoiceId: string,
    body: { paid_via: string; payment_reference?: string; payment_notes?: string },
  ) => ApiService.post(`/control-plane/admin/invoices/${invoiceId}/mark-paid`, body),

  // Tab data
  listUsers: (id: string) =>
    ApiService.get<{ users: AdminTenantUser[] } & V2Hint>(`/control-plane/admin/tenants/${id}/users`),
  listSessions: (id: string) =>
    ApiService.get<{ sessions: AdminTenantSession[] } & V2Hint>(`/control-plane/admin/tenants/${id}/sessions`),
  listApiTokens: (id: string) =>
    ApiService.get<{ tokens: AdminTenantApiToken[] } & V2Hint>(`/control-plane/admin/tenants/${id}/api-tokens`),
  listWebhooks: (id: string) =>
    ApiService.get<{
      endpoints: AdminTenantWebhookEndpoint[];
      deliveries: AdminTenantWebhookDelivery[];
    } & V2Hint>(`/control-plane/admin/tenants/${id}/webhooks`),
  listInvoices: (id: string) =>
    ApiService.get<{ invoices: AdminTenantInvoice[] }>(`/control-plane/admin/tenants/${id}/invoices`),
  listMigrations: (id: string) =>
    ApiService.get<{ migrations: AdminTenantMigration[] }>(`/control-plane/admin/tenants/${id}/migrations`),
  listAdminActions: (id: string) =>
    ApiService.get<{ actions: AdminTenantAuditAction[] }>(`/control-plane/admin/tenants/${id}/admin-actions`),
};
