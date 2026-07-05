import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('./api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { InterviewService } from './interview.service';

beforeEach(() => {
  vi.clearAllMocks();
  const ok = { success: true, data: {}, message: undefined };
  get.mockResolvedValue(ok);
  post.mockResolvedValue(ok);
  patch.mockResolvedValue(ok);
  del.mockResolvedValue(ok);
});

describe('InterviewService.getSessions', () => {
  test('defaults to limit=10 offset=0 with no status/search', async () => {
    await InterviewService.getSessions();
    expect(get).toHaveBeenCalledWith('/interview-sessions?limit=10&offset=0', undefined, 'auth');
  });

  test('computes offset from page and includes status + trimmed search', async () => {
    await InterviewService.getSessions({ page: 3, pageSize: 20, status: 'completed', search: '  jane  ' });
    expect(get).toHaveBeenCalledWith(
      '/interview-sessions?limit=20&offset=40&status=completed&search=jane',
      undefined,
      'auth',
    );
  });

  test('status "all" is omitted from the query', async () => {
    await InterviewService.getSessions({ status: 'all' });
    expect(get.mock.calls[0][0]).toBe('/interview-sessions?limit=10&offset=0');
  });

  test('pageSize is clamped to 100', async () => {
    await InterviewService.getSessions({ pageSize: 500 });
    expect(get.mock.calls[0][0]).toContain('limit=100');
  });
});

describe('InterviewService reads', () => {
  test('getCounts', async () => {
    await InterviewService.getCounts();
    expect(get).toHaveBeenCalledWith('/interview-sessions/counts', undefined, 'auth');
  });

  test('getById', async () => {
    await InterviewService.getById('s1');
    expect(get).toHaveBeenCalledWith('/interview-sessions/s1', undefined, 'auth');
  });

  test('getPostAnalysis', async () => {
    await InterviewService.getPostAnalysis('s1');
    expect(get).toHaveBeenCalledWith('/interviews/s1/analysis', undefined, 'auth');
  });
});

describe('InterviewService.createInterview', () => {
  test('builds the payload with defaulted status + null description', async () => {
    await InterviewService.createInterview({
      title: 'FE',
      scheduled_start_at: 'a',
      scheduled_end_at: 'b',
      timezone: 'UTC',
      meeting_link: 'https://meet',
      interview_session_participants: [],
    });
    const [url, body, third, base] = post.mock.calls[0];
    expect(url).toBe('/interview-sessions');
    expect(third).toBeUndefined();
    expect(base).toBe('auth');
    expect(body).toMatchObject({
      title: 'FE',
      description: null,
      status: 'SCHEDULED',
      timezone: 'UTC',
      meeting_link: 'https://meet',
    });
  });

  test('honours an explicit status', async () => {
    await InterviewService.createInterview({
      title: 'FE', scheduled_start_at: 'a', scheduled_end_at: 'b', timezone: 'UTC',
      meeting_link: 'x', status: 'ACTIVE', interview_session_participants: [],
    });
    expect((post.mock.calls[0][1] as Record<string, unknown>).status).toBe('ACTIVE');
  });
});

describe('InterviewService lifecycle transitions', () => {
  test('activate / deactivate / heartbeat post empty bodies to their routes', async () => {
    await InterviewService.activate('s1');
    expect(post).toHaveBeenCalledWith('/interview-sessions/s1/activate', {}, undefined, 'auth');
    await InterviewService.deactivate('s1');
    expect(post).toHaveBeenLastCalledWith('/interview-sessions/s1/deactivate', {}, undefined, 'auth');
    await InterviewService.heartbeat('s1');
    expect(post).toHaveBeenLastCalledWith('/interview-sessions/s1/heartbeat', {}, undefined, 'auth');
  });

  test('triggerPostAnalysis posts to the analyze route', async () => {
    await InterviewService.triggerPostAnalysis('s1');
    expect(post).toHaveBeenCalledWith('/interviews/s1/analyze', {}, undefined, 'auth');
  });

  test('update patches and remove deletes', async () => {
    await InterviewService.update('s1', { title: 'New' });
    expect(patch).toHaveBeenCalledWith('/interview-sessions/s1', { title: 'New' }, undefined, 'auth');
    await InterviewService.remove('s1');
    expect(del).toHaveBeenCalledWith('/interview-sessions/s1', undefined, 'auth');
  });
});
