import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { normalizePhone } from "../../utils/phone";
import type { ListReviewsQuery, SubmitReviewInput } from "./reviews.schema";

export async function submitReview(tenantId: string, productId: string, input: SubmitReviewInput) {
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");

  const phone = normalizePhone(input.customerPhone);

  try {
    return await prisma.productReview.create({
      data: {
        tenantId,
        productId,
        customerPhone: phone,
        customerName: input.customerName,
        rating: input.rating,
        text: input.text,
        isApproved: false,
      },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new AppError(409, "ALREADY_REVIEWED", "You have already reviewed this product");
    }
    throw err;
  }
}

export async function listStorefrontReviews(tenantId: string, productId: string) {
  const reviews = await prisma.productReview.findMany({
    where: { tenantId, productId, isApproved: true },
    orderBy: { createdAt: "desc" },
  });

  const agg = await prisma.productReview.aggregate({
    where: { tenantId, productId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    reviews,
    averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    reviewCount: agg._count._all,
  };
}

export async function getProductRatingSummary(tenantId: string, productId: string) {
  const agg = await prisma.productReview.aggregate({
    where: { tenantId, productId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    reviewCount: agg._count._all,
  };
}

export async function listAdminReviews(tenantId: string, query: ListReviewsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where = {
    tenantId,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.approved !== undefined ? { isApproved: query.approved } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.productReview.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function approveReview(tenantId: string, id: string) {
  const review = await prisma.productReview.findFirst({ where: { id, tenantId } });
  if (!review) throw new AppError(404, "NOT_FOUND", "Review not found");
  return prisma.productReview.update({ where: { id }, data: { isApproved: true } });
}

export async function deleteReview(tenantId: string, id: string) {
  const review = await prisma.productReview.findFirst({ where: { id, tenantId } });
  if (!review) throw new AppError(404, "NOT_FOUND", "Review not found");
  await prisma.productReview.delete({ where: { id } });
}
