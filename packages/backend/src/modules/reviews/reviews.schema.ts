import { z } from "zod";

export const submitReviewSchema = z.object({
  customerPhone: z.string().min(3).max(30),
  customerName: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
});

export const listReviewsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  approved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
