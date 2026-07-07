import { apiRequest } from "./client";

export interface VideoBanner {
  id: string;
  title: string;
  videoUrl: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function listAll(): Promise<{ items: VideoBanner[] }> {
  return apiRequest("/api/video-banners/all");
}

export function create(data: { title: string; videoUrl: string; position?: number; isActive?: boolean }): Promise<{ item: VideoBanner }> {
  return apiRequest("/api/video-banners", { method: "POST", body: data });
}

export function update(id: string, data: Partial<{ title: string; videoUrl: string; position: number; isActive: boolean }>): Promise<{ item: VideoBanner }> {
  return apiRequest(`/api/video-banners/${id}`, { method: "PATCH", body: data });
}

export function remove(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/video-banners/${id}`, { method: "DELETE" });
}
