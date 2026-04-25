/**
 * useInterviewList — thin fetch hook for /interview-sessions/upcoming
 * and /past.
 *
 * Previously this module held an app-wide cache with a 60s TTL +
 * stale-while-revalidate. That was removed — the product wants live
 * data on every mount and every tab switch. The hook now fetches
 * directly on mount and exposes `refresh()` for explicit re-fetches.
 *
 * The `Provider` is kept as a no-op wrapper so App.tsx doesn't need
 * to be touched; it can be dropped later if you like.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { InterviewService } from '../services/interview.service';
import { useAuth } from './AuthContext';
import type { InterviewSession } from '../types/interview.types';

type When = 'upcoming' | 'past';

interface Snapshot {
  /** Current list; `null` until the first fetch resolves. */
  data: InterviewSession[] | null;
  /** True while the first (cold) fetch is in flight. */
  loading: boolean;
  /** True when a manual refresh is running alongside existing data. */
  refetching: boolean;
  /** Force a re-fetch. */
  refresh: () => Promise<void>;
}

/** No-op wrapper — kept for backward compatibility with existing
 *  imports in App.tsx. Holds no state of its own. */
export function InterviewCacheProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useInterviewList(when: When): Snapshot {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<InterviewSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  // Track whether this hook instance has ever done a fetch — used so
  // `refresh()` doesn't accidentally show the "first load" shimmer on
  // later invocations.
  const hasFetchedRef = useRef(false);

  const fetchList = useCallback(
    async (mode: 'cold' | 'refresh') => {
      if (!userId) return;
      if (mode === 'cold') setLoading(true);
      else setRefetching(true);
      try {
        // Initial fetch matches the table's default page size (10).
        // Pagination at the call site re-fetches direct with the
        // user-chosen limit when they change page or page size.
        const resp =
          when === 'upcoming'
            ? await InterviewService.getUpcoming(10, 0)
            : await InterviewService.getPast(10, 0);
        setData(resp.data ?? []);
      } catch {
        // Swallow — UI surfaces failures via snackbar / inline alert
        // higher up. We deliberately don't clobber `data` on error so
        // a transient failure keeps the last-known list visible.
      } finally {
        hasFetchedRef.current = true;
        if (mode === 'cold') setLoading(false);
        else setRefetching(false);
      }
    },
    [userId, when]
  );

  // Fetch on mount / when the user changes.
  useEffect(() => {
    if (!userId) {
      setData(null);
      hasFetchedRef.current = false;
      return;
    }
    void fetchList(hasFetchedRef.current ? 'refresh' : 'cold');
  }, [userId, fetchList]);

  const refresh = useCallback(() => fetchList('refresh'), [fetchList]);

  return { data, loading, refetching, refresh };
}
