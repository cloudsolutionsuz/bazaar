import { z } from "zod";

export const createPromotionSchema = z.object({
  name: z.string().min(1).max(200),
  discountPercent: z.number().int().min(1).max(99).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const updatePromotionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  discountPercent: z.number().int().min(1).max(99).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listPromotionsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// Bulk-attach a set of products to a promotion (or apply a discount to
// products in bulk) by one of: explicit IDs, a category, a brand, or a
// supplier (matched via any of the product's variants) - matches the ТЗ's
// "прикрепить товаров по названием/выделением, категориям, брендом,
// поставщикам" ask. Exactly one of these selector fields must be set.
export const productSelectorSchema = z
  .object({
    productIds: z.array(z.string().uuid()).optional(),
    categoryId: z.string().uuid().optional(),
    brand: z.string().max(120).optional(),
    supplierId: z.string().uuid().optional(),
  })
  .refine((v) => !!(v.productIds?.length || v.categoryId || v.brand || v.supplierId), {
    message: "One of productIds, categoryId, brand, or supplierId is required",
  });

export const bulkDiscountSchema = productSelectorSchema.and(
  z.object({ discountPercent: z.number().int().min(1).max(99).nullable() }),
);

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;
export type ProductSelectorInput = z.infer<typeof productSelectorSchema>;
export type BulkDiscountInput = z.infer<typeof bulkDiscountSchema>;
