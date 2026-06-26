import { z } from "zod";

export const listCustomersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
