/**
 * InterviewCacheContext — in-memory cache for /upcoming and /past
 * interview lists, keyed per user id.
 *
 * Behaviour:
 *   - First visit to a list page: fetches, caches, resolves normally.
 *   - Return visit: renders cached data immediately, then refetches in
 *     the background (stale-while-revalidate). The caller sees "loading
 *     = false" because there's data; the shimmer never flashes.
 *   - Cache TTL: 60s. After that, next read returns cache immediately
 *     but marks it stale so the refetch happens.
 *   - Logout / user change: cache is cleared (keyed on userId).
 *
 * Not a React Query replacement — just the minimum to make the two
 * list pages feel instant on repeated navigations.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { InterviewService } from '../services/interview.service';
import { useAuth } from './AuthContext';
import type { InterviewSession } from '../types/interview.types';

type When = 'upcoming' | 'past';

interface CacheEntry {
  data: InterviewSession[];
  fetchedAt: number;
  userId: string;
}

interface Snapshot {
  /** Cached list; `null` when nothing has been fetched yet. */
  data: InterviewSession[] | null;
  /** True on the very first load when no cache exists. */
  loading: boolean;
  /** True when a background refetch is running alongside stale data. */
  refetching: boolean;
  /** Force a refetch. */
  refresh: () => Promise<void>;
}

interface ContextValue {
  get: (when: When) => Snapshot;
}

const STALE_MS = 60_000;
const InterviewCacheContext = createContext<ContextValue | null>(null);

export function InterviewCacheProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // One ref per list — used to store the cached response across renders
  // without triggering extra renders on cache writes.
  const cacheRef = useRef<Record<When, CacheEntry | null>>({
    upcoming: null,
    past: null,
  });

  // Per-list visible state. `data` is what consumers render; changes to
  // it cause the subscribed pages to re-render.
  const [data, setData] = useState<Record<When, InterviewSession[] | null>>({
    upcoming: null,
    past: null,
  });
  const [loading, setLoading] = useState<Record<When, boolean>>({
    upcoming: false,
    past: false,
  });
  const [refetching, setRefetching] = useState<Record<When, boolean>>({
    upcoming: false,
    past: false,
  });

  // Drop everything when the user changes (login / logout / switch).
  useEffect(() => {
    cacheRef.current = { upcoming: null, past: null };
    setData({ upcoming: null, past: null });
    setLoading({ upcoming: false, past: false });
    setRefetching({ upcoming: false, past: false });
  }, [userId]);

  const fetchList = useCallback(
    async (when: When, mode: 'cold' | 'refresh') => {
      if (!userId) return;
      if (mode === 'cold') {
        setLoading((p) => ({ ...p, [when]: true }));
      } else {
        setRefetching((p) => ({ ...p, [when]: true }));
      }
      try {
        const resp =
          when === 'upcoming'
            ? await InterviewService.getUpcoming(100, 0)
            : await InterviewService.getPast(100, 0);
        const list = resp.data ?? [];
        cacheRef.current[when] = {
          data: list,
          fetchedAt: Date.now(),
          userId,
        };
        setData((p) => ({ ...p, [when]: list }));
      } catch {
        // Swallow — pages keep whatever they had. Surface errors via
        // the Snackbar provider higher up if needed.
      } finally {
        if (mode === 'cold') {
          setLoading((p) => ({ ...p, [when]: false }));
        } else {
          setRefetching((p) => ({ ...p, [when]: false }));
        }
      }
    },
    [userId]
  );

  const get = useCallback(
    (when: When): Snapshot => {
      const cached = cacheRef.current[when];
      const cachedForThisUser = cached && cached.userId === userId;
      const stale = cachedForThisUser && Date.now() - cached!.fetchedAt > STALE_MS;

      // Kick off initial or revalidation fetches lazily on first read —
      // we don't want the provider to fetch both lists upfront if the
      // user never visits them.
      if (!cachedForThisUser && !loading[when] && userId) {
        // fire-and-forget; the state update inside fetchList triggers rerender
        void fetchList(when, 'cold');
      } else if (stale && !refetching[when] && userId) {
        void fetchList(when, 'refresh');
      }

      return {
        data: data[when],
        loading: loading[when] && data[when] === null,
        refetching: refetching[when],
        refresh: () => fetchList(when, 'refresh'),
      };
    },
    [data, loading, refetching, fetchList, userId]
  );

  const value = useMemo(() => ({ get }), [get]);

  return (
    <InterviewCacheContext.Provider value={value}>
      {children}
    </InterviewCacheContext.Provider>
  );
}

export function useInterviewList(when: When): Snapshot {
  const ctx = useContext(InterviewCacheContext);
  if (!ctx) {
    throw new Error('useInterviewList must be used inside <InterviewCacheProvider>');
  }
  return ctx.get(when);
}
