import { ApiService } from './api.service';
import { ENV } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type { Plan, Subscription, CheckoutCreds, VerifyInput, Invoice } from '../types/billing.types';

/** V1 customer-billing usage (shared-DB tenants). */
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

/** V1 customer-billing invoice (/api/companies/me/invoices). Distinct from
 *  the Razorpay subscription Invoice in billing.types. */
export interface BillingInvoice {
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
  async listPlans(): Promise<Plan[]> {
    const resp = await ApiService.get<Plan[]>('/api/payments/plans');
    return resp.data ?? [];
  },

  async getSubscription(): Promise<Subscription | null> {
    const resp = await ApiService.get<Subscription | null>('/api/payments/subscription');
    return resp.data ?? null;
  },

  async createSubscription(planKey: string): Promise<CheckoutCreds> {
    const resp = await ApiService.post<CheckoutCreds>('/api/payments/create-subscription', {
      plan_key: planKey,
    });
    return resp.data!;
  },

  async verifySubscription(input: VerifyInput): Promise<void> {
    await ApiService.post('/api/payments/verify-subscription', input);
  },

  async cancelSubscription(razorpaySubscriptionId: string): Promise<void> {
    await ApiService.post('/api/payments/cancel-subscription', {
      razorpay_subscription_id: razorpaySubscriptionId,
    });
  },

  async listInvoices(page = 1, pageSize = 10): Promise<{ items: Invoice[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const resp = await ApiService.get<{ items: Invoice[]; total: number }>(
      `/api/payments/invoices?limit=${pageSize}&offset=${offset}`
    );
    return { items: resp.data?.items ?? [], total: resp.data?.total ?? 0 };
  },

  /** Fetch the server-rendered branded invoice PDF as a Blob. */
  async getInvoicePdf(id: string): Promise<Blob> {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const resp = await fetch(`${ENV.AUTH_API_URL}/api/payments/invoices/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new Error('Failed to generate invoice');
    return resp.blob();
  },

  // ── V1 customer-billing settings (/api/companies/me/*) ──
  usage: () => ApiService.get<UsageInfo>('/api/companies/me/usage'),
  invoices: () => ApiService.get<{ invoices: BillingInvoice[] }>('/api/companies/me/invoices'),
  updateBillingContact: (email: string | null) =>
    ApiService.patch('/api/companies/me/billing-contact', { billing_contact_email: email }),
};
