import { useEffect, useState } from 'react';

/**
 * useDelayedFlag — returns `true` only after `delayMs` has passed AND
 * `active` is still true. Used to suppress flicker on loading states:
 * a fetch that completes in <delayMs never shows the placeholder.
 *
 * Example:
 *   const [loading, setLoading] = useState(true);
 *   const showSkeleton = useDelayedFlag(loading, 250);
 *   return showSkeleton ? <Shimmer /> : <Content />;
 *
 * When `active` flips back to false (fetch done), the timer is cancelled
 * and the flag drops to false immediately.
 */
export function useDelayedFlag(active: boolean, delayMs: number = 250): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!active) {
      setDelayed(false);
      return;
    }
    const t = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);

  return delayed;
}
