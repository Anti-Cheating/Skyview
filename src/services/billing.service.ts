import { ApiService } from './api.service';

export interface UsageInfo {
  current: number;
  plan: string;
  plan_limit: number;
  cap_policy: string;
  overage_per_session_usd: number;
  estimated: number;
  last_reset_at: string;
  billing_contact_email: string | null;
  is_v2: boolean;
}

export interface Invoice {
  id: string;
  period: string;
  total_usd: string;
  status: string;
  due_at: string;
  paid_at: string | null;
  pdf_url: string | null;
  paid_via: string | null;
  payment_reference: string | null;
}

export const BillingService = {
  usage: () => ApiService.get<UsageInfo>('/api/companies/me/usage'),
  invoices: () => ApiService.get<{ invoices: Invoice[] }>('/api/companies/me/invoices'),
  updateBillingContact: (email: string | null) =>
    ApiService.patch('/api/companies/me/billing-contact', { billing_contact_email: email }),
};
