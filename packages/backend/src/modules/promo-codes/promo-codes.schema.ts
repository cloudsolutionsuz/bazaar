import { z } from "zod";

export const createPromoCodeSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(50)
      .transform((v) => v.toUpperCase().trim()),
    discountPercent: z.number().int().min(1).max(100).optional(),
    discountFixed: z.number().int().min(1).optional(),
    maxUses: z.number().int().min(1).optional(),
    minOrderAmount: z.number().int().min(0).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((d) => d.discountPercent !== undefined || d.discountFixed !== undefined, {
    message: "Either discountPercent or discountFixed must be set",
    path: ["discountPercent"],
  });

export const listPromoCodesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const validatePromoCodeQuerySchema = z.object({
  code: z.string().min(1).max(50),
  amount: z.coerce.number().int().min(0),
});

export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type ListPromoCodesQuery = z.infer<typeof listPromoCodesQuerySchema>;
export type ValidatePromoCodeQuery = z.infer<typeof validatePromoCodeQuerySchema>;
