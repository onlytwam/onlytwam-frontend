/**
 * shared/hooks/useDebounce.ts
 * ────────────────────────────
 * Delays a value update until the user stops typing.
 * Used in search inputs to avoid firing an API call on every keystroke.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchInput, 400);
 *   // debouncedSearch only updates after 400ms of no typing
 */

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
