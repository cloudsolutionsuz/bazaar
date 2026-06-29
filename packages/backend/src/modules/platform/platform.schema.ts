import { z } from "zod";

export const listTenantsQuerySchema = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "BLOCKED"]).optional(),
  search: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateTenantPlanSchema = z.object({
  planId: z.string().uuid(),
});

export const updateTenantVipSchema = z.object({
  isVip: z.boolean(),
});

export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
export type UpdateTenantPlanInput = z.infer<typeof updateTenantPlanSchema>;
export type UpdateTenantVipInput = z.infer<typeof updateTenantVipSchema>;
