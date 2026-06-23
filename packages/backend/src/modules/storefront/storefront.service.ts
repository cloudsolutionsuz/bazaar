import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { ListStorefrontProductsQuery } from "./storefront.schema";

const productInclude = {
  variants: true,
  images: { orderBy: { position: "asc" as const } },
  category: true,
};

export function listCategories(tenantId: string) {
  return prisma.category.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function listProducts(tenantId: string, query: ListStorefrontProductsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.ProductWhereInput = {
    tenantId,
    status: { not: "HIDDEN" },
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { variants: { some: { sku: { contains: query.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getProduct(tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, status: { not: "HIDDEN" } },
    include: productInclude,
  });
  if (!product) {
    throw new AppError(404, "NOT_FOUND", "Product not found");
  }
  return product;
}
