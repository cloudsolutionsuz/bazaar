import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { CreatePromoCodeInput, ListPromoCodesQuery } from "./promo-codes.schema";

export async function listPromoCodes(tenantId: string, query: ListPromoCodesQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const [items, total] = await Promise.all([
    prisma.promoCode.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.promoCode.count({ where: { tenantId } }),
  ]);

  return { items, total, page, pageSize };
}

export async function createPromoCode(tenantId: string, input: CreatePromoCodeInput) {
  const existing = await prisma.promoCode.findUnique({
    where: { tenantId_code: { tenantId, code: input.code } },
  });
  if (existing) {
    throw new AppError(409, "PROMO_CODE_EXISTS", "A promo code with this code already exists");
  }

  return prisma.promoCode.create({
    data: {
      tenantId,
      code: input.code,
      discountPercent: input.discountPercent,
      discountFixed: input.discountFixed,
      maxUses: input.maxUses,
      minOrderAmount: input.minOrderAmount,
      expiresAt: input.expiresAt,
    },
  });
}

export async function deactivatePromoCode(tenantId: string, id: string) {
  const code = await prisma.promoCode.findFirst({ where: { id, tenantId } });
  if (!code) throw new AppError(404, "NOT_FOUND", "Promo code not found");

  return prisma.promoCode.update({ where: { id }, data: { isActive: false } });
}

export async function validatePromoCode(
  tenantId: string,
  code: string,
  amount: number,
): Promise<{ promoCodeId: string; discountAmount: number }> {
  const promo = await prisma.promoCode.findUnique({
    where: { tenantId_code: { tenantId, code: code.toUpperCase().trim() } },
  });

  if (!promo || !promo.isActive) {
    throw new AppError(404, "PROMO_NOT_FOUND", "Promo code not found or inactive");
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new AppError(400, "PROMO_EXPIRED", "Promo code has expired");
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw new AppError(400, "PROMO_EXHAUSTED", "Promo code usage limit reached");
  }
  if (promo.minOrderAmount !== null && amount < promo.minOrderAmount) {
    throw new AppError(400, "PROMO_MIN_AMOUNT", `Minimum order amount is ${promo.minOrderAmount}`);
  }

  let discountAmount: number;
  if (promo.discountPercent !== null) {
    discountAmount = Math.round(amount * (promo.discountPercent / 100));
  } else {
    discountAmount = Math.min(promo.discountFixed!, amount);
  }

  return { promoCodeId: promo.id, discountAmount };
}
