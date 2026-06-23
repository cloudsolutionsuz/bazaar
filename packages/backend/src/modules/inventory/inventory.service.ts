import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { CreateReceiptInput, ListMovementsQuery } from "./inventory.schema";

export async function createReceipt(tenantId: string, userId: string, input: CreateReceiptInput) {
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId,
        variantId: variant.id,
        type: "RECEIPT",
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        note: input.note,
        createdByUserId: userId,
      },
    });

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { increment: input.quantity } },
    });

    return movement;
  });
}

export async function listMovements(tenantId: string, query: ListMovementsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.InventoryMovementWhereInput = {
    tenantId,
    ...(query.variantId ? { variantId: query.variantId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function listLowStock(tenantId: string) {
  const variants = await prisma.productVariant.findMany({
    where: { tenantId, lowStockThreshold: { not: null } },
    include: { product: true },
  });

  return variants.filter((v) => v.lowStockThreshold !== null && v.stockQuantity <= v.lowStockThreshold);
}
