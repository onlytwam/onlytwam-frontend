import { useEffect } from "react";

/**
 * Call this in any page to signal the RouteTransitionOverlay to dismiss
 * as soon as the page's critical data is ready, instead of waiting for
 * the 2.5 s auto-timeout.
 *
 * Example — ProductList:
 *   const { data, isSuccess } = useQuery({ ... });
 *   usePageReady(isSuccess);
 */
export function usePageReady(isReady: boolean) {
  useEffect(() => {
    if (!isReady) return;
    window.dispatchEvent(new Event("page-content-ready"));
  }, [isReady]);
}
