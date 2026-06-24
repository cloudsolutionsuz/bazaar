import { apiRequest } from "./client";
import type { Banner } from "../types/api";

export function listBanners(): Promise<{ banners: Banner[] }> {
  return apiRequest("/api/banners");
}

export function createBanner(file: File, linkUrl?: string): Promise<{ banner: Banner }> {
  const form = new FormData();
  form.append("image", file);
  if (linkUrl) form.append("linkUrl", linkUrl);
  return apiRequest("/api/banners", { method: "POST", body: form });
}

export function updateBanner(id: string, input: { linkUrl?: string | null; isActive?: boolean }): Promise<{ banner: Banner }> {
  return apiRequest(`/api/banners/${id}`, { method: "PATCH", body: input });
}

export function deleteBanner(id: string): Promise<void> {
  return apiRequest(`/api/banners/${id}`, { method: "DELETE", responseType: "none" });
}

export function reorderBanners(bannerIds: string[]): Promise<void> {
  return apiRequest("/api/banners/reorder", { method: "PATCH", body: { bannerIds }, responseType: "none" });
}
