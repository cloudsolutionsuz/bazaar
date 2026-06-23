import { z } from "zod";

export const createPlanSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  priceSum: z.number().int().positive(),
  maxProducts: z.number().int().positive().nullable().optional(),
  maxOrdersPerMonth: z.number().int().positive().nullable().optional(),
  maxEmployees: z.number().int().positive().nullable().optional(),
  features: z.record(z.string()).optional(),
});

export const updatePlanSchema = createPlanSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
