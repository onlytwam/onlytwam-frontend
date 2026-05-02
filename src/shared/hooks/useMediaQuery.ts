/**
 * shared/hooks/useMediaQuery.ts
 * ──────────────────────────────
 * Returns true when a CSS media query matches.
 * Used to conditionally render mobile vs desktop layouts
 * and, for Capacitor builds, to detect the device platform.
 *
 * Usage:
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 */

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ── Convenience hooks ─────────────────────────────────────────────────────────
export const useMobile   = () => useMediaQuery('(max-width: 768px)');
export const useTablet   = () => useMediaQuery('(max-width: 1024px)');
export const useDesktop  = () => useMediaQuery('(min-width: 1025px)');
