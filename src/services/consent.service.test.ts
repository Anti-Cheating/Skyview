import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

import { ConsentService } from './consent.service';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: {} });
  post.mockResolvedValue({ success: true, data: {} });
});

describe('ConsentService', () => {
  test('text reads the session consent-text', () => {
    ConsentService.text('s1');
    expect(get).toHaveBeenCalledWith('/interview-sessions/s1/consent-text');
  });

  test('grant posts the version', () => {
    ConsentService.grant('s1', '1.0');
    expect(post).toHaveBeenCalledWith('/interview-sessions/s1/consent', { version: '1.0' });
  });

  test('decline posts to the decline route with no body', () => {
    ConsentService.decline('s1');
    expect(post).toHaveBeenCalledWith('/interview-sessions/s1/consent/decline');
  });

  test('revoke posts to the revoke route with no body', () => {
    ConsentService.revoke('s1');
    expect(post).toHaveBeenCalledWith('/interview-sessions/s1/consent/revoke');
  });
});
