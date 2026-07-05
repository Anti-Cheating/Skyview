import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Fake socket.io client: records handlers + emits so we can drive events.
const handlers: Record<string, (...a: unknown[]) => void> = {};
const emit = vi.fn();
const on = vi.fn((event: string, cb: (...a: unknown[]) => void) => { handlers[event] = cb; });
const disconnect = vi.fn();
const ioMock = vi.fn(() => ({ on, emit, disconnect }));
vi.mock('socket.io-client', () => ({ io: (...a: unknown[]) => ioMock(...a), Socket: class {} }));

import { useRiskSocket } from './useRiskSocket';

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
  // Silence the hook's verbose console.log noise.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // fetch is used by the rehydrate effect; make it a no-op.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }));
});

describe('useRiskSocket — inert (no session)', () => {
  test('returns sane defaults and never opens a socket when sessionId is null', () => {
    const { result } = renderHook(() => useRiskSocket(null));
    expect(ioMock).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.averageScore).toBe(0);
    expect(result.current.recentScore).toBe(0);
    expect(result.current.highestRisk).toBe('none');
    expect(result.current.latestResult).toBeNull();
    expect(result.current.latestImageAnalysis).toBeNull();
    expect(result.current.modalityState).toBeNull();
    expect(result.current.candidateStatus).toBeNull();
    expect(result.current.consentStatus).toBeNull();
    expect(result.current.isImageAnalysisProcessing).toBe(false);
  });

  test('emit helpers are safe no-ops when there is no socket', () => {
    const { result } = renderHook(() => useRiskSocket(null));
    expect(() => {
      result.current.emitStartTranscription();
      result.current.emitStopAnalysis();
      result.current.emitCaptureScreenshots();
    }).not.toThrow();
  });
});

describe('useRiskSocket — pure setters / derived state', () => {
  test('setInitialCandidateStatus seeds candidateStatus only while unset', () => {
    const { result } = renderHook(() => useRiskSocket(null));
    const first = { extension_installed: true, screen_recording: true, mic_granted: true,
      keyboard_granted: true, joined: true, updated_at: null };
    act(() => result.current.setInitialCandidateStatus(first));
    expect(result.current.candidateStatus).toEqual(first);
    // A second seed does not overwrite the first.
    act(() => result.current.setInitialCandidateStatus({ ...first, joined: false }));
    expect(result.current.candidateStatus!.joined).toBe(true);
  });

  test('setInitialConsentStatus seeds consentStatus only while unset', () => {
    const { result } = renderHook(() => useRiskSocket(null));
    act(() => result.current.setInitialConsentStatus({ status: 'given', at: 't0' }));
    expect(result.current.consentStatus).toEqual({ status: 'given', at: 't0' });
    act(() => result.current.setInitialConsentStatus({ status: 'revoked', at: 't1' }));
    expect(result.current.consentStatus!.status).toBe('given');
  });

  test('incrementPendingImageAnalysis bumps the pending count + processing flag', () => {
    const { result } = renderHook(() => useRiskSocket(null));
    expect(result.current.isImageAnalysisProcessing).toBe(false);
    act(() => result.current.incrementPendingImageAnalysis(2));
    expect(result.current.pendingImageAnalysisCount).toBe(2);
    expect(result.current.isImageAnalysisProcessing).toBe(true);
  });
});

describe('useRiskSocket — live socket', () => {
  test('opens a socket for a session and registers the core handlers', () => {
    renderHook(() => useRiskSocket('s1'));
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(on).toHaveBeenCalledWith('window-result', expect.any(Function));
    expect(on).toHaveBeenCalledWith('live-transcript', expect.any(Function));
  });

  test('connect joins the session room and flips isConnected', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['connect']());
    expect(emit).toHaveBeenCalledWith('join-session', 's1');
    expect(result.current.isConnected).toBe(true);
  });

  test('a window-result updates results + derived averageScore / highestRisk', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['window-result']({
      window_id: 'w1', session_id: 's1', risk: 'high', score: 80,
      summary: '', status: 'done', processed_at: new Date().toISOString(),
    }));
    expect(result.current.results).toHaveLength(1);
    expect(result.current.averageScore).toBe(80);
    expect(result.current.highestRisk).toBe('high');
    expect(result.current.latestResult?.window_id).toBe('w1');
  });

  test('a consent-status event overwrites the live consent state', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['consent-status']({ sessionId: 's1', status: 'revoked', at: 't2' }));
    expect(result.current.consentStatus).toEqual({ status: 'revoked', at: 't2' });
  });

  test('emit helpers forward the sessionId once the socket exists', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => result.current.emitStartTranscription());
    expect(emit).toHaveBeenCalledWith('start-transcription', 's1');
  });

  test('all remaining emit helpers forward the sessionId', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => {
      result.current.emitStopTranscription();
      result.current.emitStartAnalysis();
      result.current.emitStopAnalysis();
      result.current.emitCaptureScreenshots();
    });
    expect(emit).toHaveBeenCalledWith('stop-transcription', 's1');
    expect(emit).toHaveBeenCalledWith('start-analysis', 's1');
    expect(emit).toHaveBeenCalledWith('stop-analysis', 's1');
    expect(emit).toHaveBeenCalledWith('capture-screenshots', 's1');
  });

  test('the io auth callback supplies client + token from localStorage', () => {
    localStorage.setItem('auth_access_token', 'jwt-123');
    renderHook(() => useRiskSocket('s1'));
    const opts = ioMock.mock.calls[0][1] as { auth: (cb: (d: Record<string, unknown>) => void) => void };
    const cb = vi.fn();
    opts.auth(cb);
    expect(cb).toHaveBeenCalledWith({ client: 'skyview', token: 'jwt-123' });
    localStorage.removeItem('auth_access_token');
  });

  test('disconnect flips isConnected back to false', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['connect']());
    expect(result.current.isConnected).toBe(true);
    act(() => handlers['disconnect']());
    expect(result.current.isConnected).toBe(false);
  });

  test('a risk-pulse event appends a deduped pulse alert', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    const pulse = { detections: [], activities: ['clipboard_paste'], timestamp: 't1' };
    act(() => handlers['risk-pulse'](pulse));
    act(() => handlers['risk-pulse'](pulse)); // same timestamp → deduped
    expect(result.current.pulseAlerts).toHaveLength(1);
    expect(result.current.pulseAlerts[0].activities).toEqual(['clipboard_paste']);
  });

  test('a candidate-status event coerces every flag to a boolean', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['candidate-status']({
      sessionId: 's1', extension_installed: 1, screen_recording: 0,
      mic_granted: true, keyboard_granted: undefined, joined: 'yes', updated_at: null,
    }));
    expect(result.current.candidateStatus).toEqual({
      extension_installed: true, screen_recording: false, mic_granted: true,
      keyboard_granted: false, joined: true, updated_at: expect.any(String),
    });
  });

  test('candidate-status keeps a provided updated_at timestamp', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['candidate-status']({
      sessionId: 's1', extension_installed: true, screen_recording: true,
      mic_granted: true, keyboard_granted: true, joined: true, updated_at: '2026-01-01T00:00:00Z',
    }));
    expect(result.current.candidateStatus!.updated_at).toBe('2026-01-01T00:00:00Z');
  });

  test('a modality-state event coerces both toggles to booleans', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['modality-state']({ sessionId: 's1', transcription: 1, analysis: 0 }));
    expect(result.current.modalityState).toEqual({ transcription: true, analysis: false });
  });

  test('an image-analysis-result merges + decrements the pending counter', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => result.current.incrementPendingImageAnalysis(1));
    expect(result.current.pendingImageAnalysisCount).toBe(1);
    const img = {
      analysis_id: 'a1', session_id: 's1', status: 'done', risk: 'low', score: 10,
      summary: '', image_count: 1, processed_at: new Date().toISOString(),
      image_signals: [], image_evidence: [], thumbnail_urls: [],
    };
    act(() => handlers['image-analysis-result'](img));
    expect(result.current.imageAnalysisResults).toHaveLength(1);
    expect(result.current.latestImageAnalysis?.analysis_id).toBe('a1');
    expect(result.current.pendingImageAnalysisCount).toBe(0);
    expect(result.current.isImageAnalysisProcessing).toBe(false);
  });

  test('recentScore falls back to the last 3 windows when none are recent', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const win = (id: string, score: number, ts: string) => ({
      window_id: id, session_id: 's1', risk: 'low', score,
      summary: '', status: 'done', processed_at: ts,
    });
    act(() => {
      handlers['window-result'](win('w1', 10, old));
      handlers['window-result'](win('w2', 20, old));
      handlers['window-result'](win('w3', 30, old));
      handlers['window-result'](win('w4', 60, old));
    });
    // No windows in the last 5 min → averages the last 3 (20,30,60) = 37.
    expect(result.current.recentScore).toBe(37);
  });

  test('recentScore averages only windows from the last 5 minutes when present', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    const now = new Date().toISOString();
    act(() => {
      handlers['window-result']({ window_id: 'r1', session_id: 's1', risk: 'low', score: 40, summary: '', status: 'done', processed_at: now });
      handlers['window-result']({ window_id: 'r2', session_id: 's1', risk: 'low', score: 60, summary: '', status: 'done', processed_at: now });
    });
    expect(result.current.recentScore).toBe(50);
  });
});

describe('useRiskSocket — live-transcript handler', () => {
  const tf = (over: Record<string, unknown>) => ({ text: 't', is_final: true, timestamp: 'x', ...over });

  test('missing speaker_role defaults to candidate and appends', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['live-transcript'](tf({ text: 'anon', is_final: true, timestamp: '1' })));
    expect(result.current.transcriptFragments).toHaveLength(1);
    expect(result.current.transcriptFragments[0].speaker_role).toBe('candidate');
  });

  test('an interim fragment is replaced in place per speaker', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['live-transcript'](tf({ text: 'hel', is_final: false, timestamp: '1', speaker_role: 'candidate' })));
    act(() => handlers['live-transcript'](tf({ text: 'hello', is_final: false, timestamp: '2', speaker_role: 'candidate' })));
    expect(result.current.transcriptFragments).toHaveLength(1);
    expect(result.current.transcriptFragments[0].text).toBe('hello');
  });

  test('a final fragment for the same speaker is appended (break path)', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['live-transcript'](tf({ text: 'done', is_final: true, timestamp: '1', speaker_role: 'candidate' })));
    act(() => handlers['live-transcript'](tf({ text: 'next', is_final: true, timestamp: '2', speaker_role: 'candidate' })));
    expect(result.current.transcriptFragments.map(f => f.text)).toEqual(['done', 'next']);
  });

  test('a different speaker appends without clobbering the other', () => {
    const { result } = renderHook(() => useRiskSocket('s1'));
    act(() => handlers['live-transcript'](tf({ text: 'cand interim', is_final: false, timestamp: '1', speaker_role: 'candidate' })));
    act(() => handlers['live-transcript'](tf({ text: 'interviewer q', is_final: true, timestamp: '2', speaker_role: 'interviewer' })));
    expect(result.current.transcriptFragments).toHaveLength(2);
  });
});

describe('useRiskSocket — rehydrate from Cortex history', () => {
  function stubRehydrateFetch() {
    const now = new Date().toISOString();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      let body: unknown = null;
      if (url.endsWith('/windows')) {
        body = { data: { results: [{ window_id: 'hw1', session_id: 's1', risk: 'high', score: 90, summary: '', status: 'done', processed_at: now }] } };
      } else if (url.endsWith('/image-analysis')) {
        body = { data: { results: [{ analysis_id: 'hi1', session_id: 's1', status: 'done', risk: 'low', score: 5, summary: '', image_count: 1, processed_at: now, image_signals: [], image_evidence: [], thumbnail_urls: [] }] } };
      } else if (url.endsWith('/pulse-events')) {
        body = { data: { results: [{ detections: [], activities: ['clipboard_copy'], timestamp: 'p-hist' }] } };
      } else if (url.endsWith('/transcript')) {
        body = { data: { utterances: [
          { text: 'history line', speaker_role: 'interviewer', participant_id: 'pi', start_ms: 0, end_ms: 100, captured_at: '2026-07-05T00:00:00.000Z' },
          { text: 'no times', speaker_role: 'candidate', captured_at: '2026-07-05T00:00:01.000Z' },
        ] } };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }));
  }

  test('merges fetched windows / images / pulses / transcript into state', async () => {
    stubRehydrateFetch();
    const { result } = renderHook(() => useRiskSocket('s1'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].window_id).toBe('hw1');
    await waitFor(() => expect(result.current.imageAnalysisResults).toHaveLength(1));
    expect(result.current.imageAnalysisResults[0].analysis_id).toBe('hi1');
    await waitFor(() => expect(result.current.pulseAlerts).toHaveLength(1));
    await waitFor(() => expect(result.current.transcriptFragments).toHaveLength(2));
    const interviewer = result.current.transcriptFragments.find(f => f.speaker_role === 'interviewer');
    expect(interviewer?.text).toBe('history line');
    const candidate = result.current.transcriptFragments.find(f => f.speaker_role === 'candidate');
    expect(candidate?.start_ms).toBeUndefined();
  });
});
