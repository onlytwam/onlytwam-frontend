/**
 * src/features/images/api/images.api.ts
 * ──────────────────────────────────────
 * All HTTP calls for the /api/images module.
 */

import api from "@/shared/api/axiosInstance";

export interface PageImageDto {
  pageKey: string;
  imageUrl: string;
  description?: string;
}

export interface PageImagesListDto {
  images: PageImageDto[];
}

/** Fetch the image URL for a single page slot. */
export async function getPageImage(pageKey: string): Promise<PageImageDto> {
  const response = await api.get<PageImageDto>(`/images/${pageKey}`);
  return response.data;
}

/** Fetch all registered page images (used by the admin image-manager). */
export async function getAllPageImages(): Promise<PageImagesListDto> {
  const response = await api.get<PageImagesListDto>("/images");
  return response.data;
}

/** Upload / replace the image for a page slot (admin only). */
export async function uploadPageImage(
  pageKey: string,
  file: File,
): Promise<{ success: boolean; pageKey: string; imageUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.put(`/images/${pageKey}`, form);
  return response.data;
}
