import { z } from "zod";

export const updateBannerSchema = z.object({
  linkUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const reorderBannersSchema = z.object({
  bannerIds: z.array(z.string().uuid()).min(1),
});

export const createBannerSchema = z.object({
  linkUrl: z.string().url().max(500).optional(),
});

export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
export type ReorderBannersInput = z.infer<typeof reorderBannersSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
