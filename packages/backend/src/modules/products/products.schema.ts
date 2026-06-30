import { z } from "zod";

export const variantInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  sku: z.string().min(1).max(64),
  priceOverride: z.number().int().positive().optional(),
  costPrice: z.number().int().positive().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  supplierId: z.string().uuid().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  descriptionRu: z.string().max(5000).optional(),
  descriptionUz: z.string().max(5000).optional(),
  price: z.number().int().positive(),
  discountPercent: z.number().int().min(1).max(99).optional(),
  brand: z.string().max(120).optional(),
  color: z.string().max(120).optional(),
  code: z.string().max(120).optional(),
  currency: z.string().max(10).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "OUT_OF_STOCK"]).optional(),
  variants: z.array(variantInputSchema).min(1).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  descriptionRu: z.string().max(5000).nullable().optional(),
  descriptionUz: z.string().max(5000).nullable().optional(),
  price: z.number().int().positive().optional(),
  discountPercent: z.number().int().min(1).max(99).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  color: z.string().max(120).nullable().optional(),
  code: z.string().max(120).nullable().optional(),
  currency: z.string().max(10).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "OUT_OF_STOCK"]).optional(),
});

export const createVariantSchema = variantInputSchema;

// stockQuantity is deliberately excluded from updates: stock must only change
// through inventory movements (receipts) or order processing, so the
// inventory_log ledger always stays the source of truth for "why did this change".
export const updateVariantSchema = variantInputSchema.omit({ stockQuantity: true }).partial();

export const listProductsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "HIDDEN", "OUT_OF_STOCK"]).optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
