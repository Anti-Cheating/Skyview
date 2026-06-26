import { ApiService } from './api.service';
import { ENV } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type { Plan, Subscription, CheckoutCreds, VerifyInput, Invoice } from '../types/billing.types';

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
};
