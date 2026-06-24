import { ApiService } from './api.service';
import type { Plan, Subscription, CheckoutCreds, VerifyInput } from '../types/billing.types';

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
};
