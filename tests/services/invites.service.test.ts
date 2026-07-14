import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('../../src/services/api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { InvitesService } from '../../src/services/invites.service';

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
  post.mockResolvedValue({ success: true, data: {} });
  del.mockResolvedValue({ success: true, data: {} });
});

describe('InvitesService authed calls', () => {
  test('create posts against the company invites route on the auth base', async () => {
    await InvitesService.create('c1', { email: 'x@y.com', role: 'Admin' });
    expect(post).toHaveBeenCalledWith(
      '/companies/c1/invites',
      { email: 'x@y.com', role: 'Admin' },
      undefined,
      'auth',
    );
  });

  test('listMembers builds a paginated query with trimmed search', async () => {
    await InvitesService.listMembers('c1', { page: 2, pageSize: 5, search: '  bob ' });
    expect(get).toHaveBeenCalledWith(
      '/companies/c1/members?limit=5&offset=5&search=bob',
      undefined,
      'auth',
    );
  });

  test('list (invites) defaults pagination', async () => {
    await InvitesService.list('c1');
    expect(get).toHaveBeenCalledWith(
      '/companies/c1/invites?limit=10&offset=0',
      undefined,
      'auth',
    );
  });

  test('revoke deletes; resend posts with undefined body', async () => {
    await InvitesService.revoke('i1');
    expect(del).toHaveBeenCalledWith('/invites/i1', undefined, 'auth');
    await InvitesService.resend('i1');
    expect(post).toHaveBeenCalledWith('/invites/i1/resend', undefined, undefined, 'auth');
  });
});

describe('InvitesService public (fetch-based) calls', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => vi.unstubAllGlobals());

  test('getPublic returns the data envelope on 200', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { email: 'x@y.com' } }) });
    const res = await InvitesService.getPublic('tok tok');
    expect(res).toEqual({ email: 'x@y.com' });
    // token is URL-encoded into the path
    expect(fetchMock.mock.calls[0][0]).toContain('/invites/tok%20tok');
  });

  test('getPublic returns null on a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await InvitesService.getPublic('tok')).toBeNull();
  });

  test('getPublic swallows network errors and returns null', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    expect(await InvitesService.getPublic('tok')).toBeNull();
  });

  test('accept returns ok+data on success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { accessToken: 'a' } }) });
    const res = await InvitesService.accept('tok', { first_name: 'B' });
    expect(res).toEqual({ ok: true, data: { accessToken: 'a' } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ first_name: 'B' }));
  });

  test('accept returns ok:false with the server error on failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'expired' }) });
    expect(await InvitesService.accept('tok', {})).toEqual({ ok: false, error: 'expired' });
  });

  test('accept maps a network error to ok:false', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await InvitesService.accept('tok', {})).toEqual({ ok: false, error: 'offline' });
  });
});
