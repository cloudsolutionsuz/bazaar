import { z } from "zod";

export const listStorefrontProductsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  brand: z.string().max(120).optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  discountedOnly: z.coerce.boolean().optional(),
  promotedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListStorefrontProductsQuery = z.infer<typeof listStorefrontProductsQuerySchema>;

export const trackPageViewSchema = z.object({
  sessionId: z.string().min(1).max(100),
  path: z.string().min(1).max(300),
});

export type TrackPageViewInput = z.infer<typeof trackPageViewSchema>;

export const myOrdersQuerySchema = z.object({
  phone: z.string().min(3).max(30),
});

export type MyOrdersQuery = z.infer<typeof myOrdersQuerySchema>;

export const sendChatMessageSchema = z.object({
  phone: z.string().min(3).max(30),
  name: z.string().min(1).max(200),
  text: z.string().min(1).max(2000),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
