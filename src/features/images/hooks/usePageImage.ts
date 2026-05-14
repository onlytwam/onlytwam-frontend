/**
 * src/features/images/hooks/usePageImage.ts
 * ────────────────────────────────────────────
 * Fetches a single page image URL from the backend.
 * Returns an empty string while loading or when no image has been uploaded
 * yet — components are responsible for handling the empty case gracefully
 * (hide the element or show a neutral placeholder).
 *
 * Usage:
 *   const loginBg = usePageImage(IMAGE_KEYS.LOGIN_BACKGROUND);
 *   const twamBg  = usePageImage(IMAGE_KEYS.HOME_SECTION_TWAM);
 */

import { useQuery } from "@tanstack/react-query";
import { getPageImage } from "@/features/images/api/images.api";
import type { ImageKey } from "@/features/images/constants/imageKeys";

export function usePageImage(pageKey: ImageKey): string {
  const { data } = useQuery({
    queryKey: ["page-image", pageKey],
    queryFn: () => getPageImage(pageKey),
    staleTime: 5 * 60 * 1000, // treat as fresh for 5 min
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const url = data?.imageUrl?.trim();
  // Return the live URL if present, or empty string (no static fallback)
  return url || "";
}
