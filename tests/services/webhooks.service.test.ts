import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('../../src/services/api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { WebhooksService } from '../../src/services/webhooks.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WebhooksService endpoints', () => {
  test('listEndpoints unwraps the endpoints array, defaulting to []', async () => {
    get.mockResolvedValue({ success: true, data: { endpoints: [{ id: 'e1' }] } });
    expect(await WebhooksService.listEndpoints()).toEqual([{ id: 'e1' }]);
    expect(get).toHaveBeenCalledWith('/api/companies/me/webhook-endpoints');
    get.mockResolvedValue({ success: true, data: undefined });
    expect(await WebhooksService.listEndpoints()).toEqual([]);
  });

  test('createEndpoint posts input and returns the created endpoint', async () => {
    const created = { id: 'e1', signing_secret: 'whsec_x' };
    post.mockResolvedValue({ success: true, data: created });
    const input = { label: 'Prod', url: 'https://h', event_types: ['*' as const] };
    expect(await WebhooksService.createEndpoint(input)).toBe(created);
    expect(post).toHaveBeenCalledWith('/api/companies/me/webhook-endpoints', input);
  });

  test('createEndpoint throws on an empty response', async () => {
    post.mockResolvedValue({ success: true, data: undefined });
    await expect(
      WebhooksService.createEndpoint({ label: 'x', url: 'y', event_types: [] }),
    ).rejects.toThrow(/Empty response/);
  });

  test('updateEndpoint patches by id', async () => {
    patch.mockResolvedValue({ success: true });
    await WebhooksService.updateEndpoint('e1', { status: 'paused' });
    expect(patch).toHaveBeenCalledWith('/api/companies/me/webhook-endpoints/e1', { status: 'paused' });
  });

  test('revokeEndpoint deletes by id', async () => {
    del.mockResolvedValue({ success: true });
    await WebhooksService.revokeEndpoint('e1');
    expect(del).toHaveBeenCalledWith('/api/companies/me/webhook-endpoints/e1');
  });

  test('rotateSecret returns the new signing secret', async () => {
    post.mockResolvedValue({ success: true, data: { signing_secret: 'whsec_new' } });
    expect(await WebhooksService.rotateSecret('e1')).toBe('whsec_new');
    expect(post).toHaveBeenCalledWith('/api/companies/me/webhook-endpoints/e1/rotate-secret');
  });

  test('rotateSecret throws when the secret is missing', async () => {
    post.mockResolvedValue({ success: true, data: {} });
    await expect(WebhooksService.rotateSecret('e1')).rejects.toThrow(/Empty response/);
  });
});

describe('WebhooksService deliveries', () => {
  test('listDeliveries with no filter hits the base path', async () => {
    get.mockResolvedValue({ success: true, data: { deliveries: [{ id: 'd1' }] } });
    expect(await WebhooksService.listDeliveries()).toEqual([{ id: 'd1' }]);
    expect(get).toHaveBeenCalledWith('/api/companies/me/webhook-deliveries');
  });

  test('listDeliveries serializes filters into a query string', async () => {
    get.mockResolvedValue({ success: true, data: { deliveries: [] } });
    await WebhooksService.listDeliveries({ endpoint_id: 'e1', status: 'failed', limit: 50 });
    expect(get).toHaveBeenCalledWith(
      '/api/companies/me/webhook-deliveries?endpoint_id=e1&status=failed&limit=50',
    );
  });

  test('refireDelivery posts to the refire route', async () => {
    post.mockResolvedValue({ success: true });
    await WebhooksService.refireDelivery('d1');
    expect(post).toHaveBeenCalledWith('/api/companies/me/webhook-deliveries/d1/refire');
  });
});
