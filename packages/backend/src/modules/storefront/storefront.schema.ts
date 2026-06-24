import { z } from "zod";

export const listStorefrontProductsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListStorefrontProductsQuery = z.infer<typeof listStorefrontProductsQuerySchema>;

export const trackPageViewSchema = z.object({
  sessionId: z.string().min(1).max(100),
  path: z.string().min(1).max(300),
});

export type TrackPageViewInput = z.infer<typeof trackPageViewSchema>;
