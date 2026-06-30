import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type {
  BulkDiscountInput,
  CreatePromotionInput,
  ListPromotionsQuery,
  ProductSelectorInput,
  UpdatePromotionInput,
} from "./promotions.schema";

function selectorWhere(tenantId: string, selector: ProductSelectorInput): Prisma.ProductWhereInput {
  if (selector.productIds?.length) return { tenantId, id: { in: selector.productIds } };
  if (selector.categoryId) return { tenantId, categoryId: selector.categoryId };
  if (selector.brand) return { tenantId, brand: selector.brand };
  if (selector.supplierId) return { tenantId, variants: { some: { supplierId: selector.supplierId } } };
  return { tenantId, id: "__none__" };
}

export async function listPromotions(tenantId: string, query: ListPromotionsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.PromotionWhereInput = {
    tenantId,
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.promotion.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getPromotion(tenantId: string, promotionId: string) {
  const promotion = await prisma.promotion.findFirst({
    where: { id: promotionId, tenantId },
    include: { products: { include: { product: true } } },
  });
  if (!promotion) {
    throw new AppError(404, "NOT_FOUND", "Promotion not found");
  }
  return promotion;
}

export function createPromotion(tenantId: string, input: CreatePromotionInput) {
  return prisma.promotion.create({
    data: {
      tenantId,
      name: input.name,
      discountPercent: input.discountPercent,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePromotion(tenantId: string, promotionId: string, input: UpdatePromotionInput) {
  await getPromotion(tenantId, promotionId);
  return prisma.promotion.update({
    where: { id: promotionId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deletePromotion(tenantId: string, promotionId: string): Promise<void> {
  await getPromotion(tenantId, promotionId);
  await prisma.promotion.delete({ where: { id: promotionId } });
}

export async function attachProducts(tenantId: string, promotionId: string, selector: ProductSelectorInput) {
  await getPromotion(tenantId, promotionId);
  const products = await prisma.product.findMany({ where: selectorWhere(tenantId, selector), select: { id: true } });

  await prisma.promotionProduct.createMany({
    data: products.map((p) => ({ promotionId, productId: p.id })),
    skipDuplicates: true,
  });

  return getPromotion(tenantId, promotionId);
}

export async function detachProduct(tenantId: string, promotionId: string, productId: string): Promise<void> {
  await getPromotion(tenantId, promotionId);
  await prisma.promotionProduct.deleteMany({ where: { promotionId, productId } });
}

// Sets (or clears, when discountPercent is null) Product.discountPercent in
// bulk for whatever the selector matches - the same selector shape as a
// promotion's attachProducts, since the ТЗ asks for the identical
// name/selection/category/brand/supplier targeting for both discounts and
// promotions.
export async function applyBulkDiscount(tenantId: string, input: BulkDiscountInput): Promise<{ updated: number }> {
  const result = await prisma.product.updateMany({
    where: selectorWhere(tenantId, input),
    data: { discountPercent: input.discountPercent },
  });
  return { updated: result.count };
}
