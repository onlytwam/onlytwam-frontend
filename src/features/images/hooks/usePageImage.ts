/**
 * src/features/images/hooks/usePageImage.ts
 * ────────────────────────────────────────────
 * Fetches a single page image URL from the backend.
 *
 * Returns an empty string when:
 *  - the image hasn't been uploaded yet
 *  - isActive === false (admin has hidden the section)
 *
 * Components can rely on the empty-string contract: falsy → hide / placeholder.
 */

import { useQuery } from "@tanstack/react-query";
import { getPageImage } from "@/features/images/api/images.api";
import type { ImageKey } from "@/features/images/constants/imageKeys";

export function usePageImage(pageKey: ImageKey): string {
  const { data } = useQuery({
    queryKey: ["page-image", pageKey],
    queryFn: () => getPageImage(pageKey),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Return empty string when image is hidden (isActive=false) or not uploaded
  if (!data || data.isActive === false) return "";
  return data.imageUrl?.trim() || "";
}
