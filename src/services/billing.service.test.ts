import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
}));

import { BillingService } from './billing.service';
import { STORAGE_KEYS } from '../config/constants';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('BillingService subscription flows', () => {
  test('listPlans unwraps data and defaults to []', async () => {
    get.mockResolvedValue({ success: true, data: [{ key: 'pro' }] });
    expect(await BillingService.listPlans()).toEqual([{ key: 'pro' }]);
    expect(get).toHaveBeenCalledWith('/api/payments/plans');
    get.mockResolvedValue({ success: true, data: undefined });
    expect(await BillingService.listPlans()).toEqual([]);
  });

  test('getSubscription returns null when absent', async () => {
    get.mockResolvedValue({ success: true, data: null });
    expect(await BillingService.getSubscription()).toBeNull();
    expect(get).toHaveBeenCalledWith('/api/payments/subscription');
  });

  test('createSubscription posts the plan key', async () => {
    post.mockResolvedValue({ success: true, data: { orderId: 'o1' } });
    const res = await BillingService.createSubscription('pro');
    expect(post).toHaveBeenCalledWith('/api/payments/create-subscription', { plan_key: 'pro' });
    expect(res).toEqual({ orderId: 'o1' });
  });

  test('verifySubscription posts the input verbatim', async () => {
    post.mockResolvedValue({ success: true, data: {} });
    const input = { razorpay_payment_id: 'p', razorpay_signature: 's' };
    await BillingService.verifySubscription(input as never);
    expect(post).toHaveBeenCalledWith('/api/payments/verify-subscription', input);
  });

  test('cancelSubscription posts the razorpay subscription id', async () => {
    post.mockResolvedValue({ success: true, data: {} });
    await BillingService.cancelSubscription('sub_1');
    expect(post).toHaveBeenCalledWith('/api/payments/cancel-subscription', {
      razorpay_subscription_id: 'sub_1',
    });
  });

  test('listInvoices computes offset from page/pageSize', async () => {
    get.mockResolvedValue({ success: true, data: { items: [{ id: 'i1' }], total: 5 } });
    const res = await BillingService.listInvoices(2, 10);
    expect(get).toHaveBeenCalledWith('/api/payments/invoices?limit=10&offset=10');
    expect(res).toEqual({ items: [{ id: 'i1' }], total: 5 });
  });
});

describe('BillingService V1 customer-billing', () => {
  test('usage / invoices / updateBillingContact hit /companies/me routes', () => {
    get.mockResolvedValue({ success: true, data: {} });
    patch.mockResolvedValue({ success: true, data: {} });
    BillingService.usage();
    expect(get).toHaveBeenCalledWith('/api/companies/me/usage');
    BillingService.invoices();
    expect(get).toHaveBeenLastCalledWith('/api/companies/me/invoices');
    BillingService.updateBillingContact('bill@acme.com');
    expect(patch).toHaveBeenCalledWith('/api/companies/me/billing-contact', {
      billing_contact_email: 'bill@acme.com',
    });
  });
});

describe('BillingService.getInvoicePdf', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => vi.unstubAllGlobals());

  test('fetches the branded PDF with the bearer token and returns a Blob', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'tok');
    const blob = new Blob(['pdf']);
    fetchMock.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    const res = await BillingService.getInvoicePdf('i1');
    expect(res).toBe(blob);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/payments/invoices/i1/pdf');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  test('throws when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(BillingService.getInvoicePdf('i1')).rejects.toThrow(/Failed to generate/);
  });
});
