import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedFlag } from './useDelayedFlag';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDelayedFlag', () => {
  test('starts false and only flips true after the delay while active', () => {
    const { result } = renderHook(() => useDelayedFlag(true, 250));
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(249); });
    expect(result.current).toBe(false);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  test('stays false if active flips off before the delay elapses', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 250), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe(false);
  });

  test('drops back to false immediately when active goes false after firing', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 250), {
      initialProps: { active: true },
    });
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  test('never fires when active is false from the start', () => {
    const { result } = renderHook(() => useDelayedFlag(false, 250));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(false);
  });
});
