export interface Plan {
  id: string;
  plan_key: string;
  name: string;
  amount: number;       // paise (₹1 = 100)
  currency: string;
  interval: string | null;  // 'monthly' | 'yearly' | null (for trial)
  interviews_per_cycle: number;
  minutes_per_interview: number;
  max_seats: number | null; // null = unlimited
  is_active: boolean;
  features?: string[];
}

export type SubscriptionStatus =
  | 'trial' | 'created' | 'active' | 'charged'
  | 'halted' | 'cancelled' | 'completed';

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  interviews_used: number;
  interviews_remaining: number;
  total_minutes_used: number;
  current_cycle: number;
  current_period_end: string | null;
  started_at: string | null;
  is_auto_pay: boolean;
  razorpay_subscription_id: string | null;
  short_url: string | null;
  plan: Plan;
  seats_used: number;
}

export interface CheckoutCreds {
  subscription_id: string;
  key_id: string;
  short_url: string | null;
}

export interface VerifyInput {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler: (response: VerifyInput) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

export interface RazorpayInstance {
  open(): void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
