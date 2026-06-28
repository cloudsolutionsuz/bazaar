import { z } from "zod";

export const createCashRegisterSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateCashRegisterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type UpdateCashRegisterInput = z.infer<typeof updateCashRegisterSchema>;
