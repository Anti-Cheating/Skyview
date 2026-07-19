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

import { ProcessService } from '../../src/services/process.service';

beforeEach(() => {
  vi.clearAllMocks();
  const ok = { success: true, data: {}, message: undefined };
  get.mockResolvedValue(ok);
  post.mockResolvedValue(ok);
  patch.mockResolvedValue(ok);
  del.mockResolvedValue(ok);
});

describe('ProcessService', () => {
  test('list defaults pagination and hits /interview-processes on the auth base', async () => {
    await ProcessService.list();
    expect(get).toHaveBeenCalledWith('/interview-processes?limit=10&offset=0', undefined, 'auth');
  });

  test('list computes offset and includes trimmed search', async () => {
    await ProcessService.list({ page: 2, pageSize: 25, search: '  fe ' });
    expect(get).toHaveBeenCalledWith('/interview-processes?limit=25&offset=25&search=fe', undefined, 'auth');
  });

  test('getById', async () => {
    await ProcessService.getById('p1');
    expect(get).toHaveBeenCalledWith('/interview-processes/p1', undefined, 'auth');
  });

  test('create posts the input', async () => {
    await ProcessService.create({ title: 'FE' } as never);
    expect(post).toHaveBeenCalledWith('/interview-processes', { title: 'FE' }, undefined, 'auth');
  });

  test('addRound posts to the rounds subroute', async () => {
    await ProcessService.addRound('p1', { round_name: 'R2' } as never);
    expect(post).toHaveBeenCalledWith('/interview-processes/p1/rounds', { round_name: 'R2' }, undefined, 'auth');
  });

  test('update patches and cancel deletes', async () => {
    await ProcessService.update('p1', { title: 'X' } as never);
    expect(patch).toHaveBeenCalledWith('/interview-processes/p1', { title: 'X' }, undefined, 'auth');
    await ProcessService.cancel('p1');
    expect(del).toHaveBeenCalledWith('/interview-processes/p1', undefined, 'auth');
  });

});
