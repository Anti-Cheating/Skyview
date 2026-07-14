import { describe, test, expect, vi, beforeEach } from 'vitest';

const patch = vi.fn();
vi.mock('../../src/services/api.service', () => ({
  ApiService: { patch: (...a: unknown[]) => patch(...a) },
}));

import { ProfileService } from '../../src/services/profile.service';

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue({ success: true, data: { id: 'u1' } });
});

describe('ProfileService', () => {
  test('updateMe patches /users/me with the input on the auth base', async () => {
    const res = await ProfileService.updateMe({ first_name: 'Jane', last_name: 'Doe' });
    expect(patch).toHaveBeenCalledWith(
      '/users/me',
      { first_name: 'Jane', last_name: 'Doe' },
      undefined,
      'auth',
    );
    expect(res.data).toEqual({ id: 'u1' });
  });
});
