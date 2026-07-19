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

import { CompaniesService } from '../../src/services/companies.service';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: { id: 'c1' } });
  post.mockResolvedValue({ success: true, data: { id: 'c1' } });
  patch.mockResolvedValue({ success: true, data: { id: 'c1' } });
  del.mockResolvedValue({ success: true, data: { id: 'c1' } });
});

describe('CompaniesService', () => {
  test('getById reads /companies/:id against the auth base', async () => {
    await CompaniesService.getById('c1');
    expect(get).toHaveBeenCalledWith('/companies/c1', undefined, 'auth');
  });

  test('update patches the row with the input', async () => {
    await CompaniesService.update('c1', { name: 'Acme' });
    expect(patch).toHaveBeenCalledWith('/companies/c1', { name: 'Acme' }, undefined, 'auth');
  });

  test('uploadLogo posts multipart FormData with a "logo" field', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await CompaniesService.uploadLogo('c1', file);
    expect(post).toHaveBeenCalledWith('/companies/c1/logo', expect.any(FormData), undefined, 'auth');
    expect((post.mock.calls[0][1] as FormData).get('logo')).toBe(file);
  });

  test('deleteLogo deletes the logo route', async () => {
    await CompaniesService.deleteLogo('c1');
    expect(del).toHaveBeenCalledWith('/companies/c1/logo', undefined, 'auth');
  });
});
