import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";

const ITEM_INCLUDE = {
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      product: { select: { id: true, name: true, images: { take: 1, select: { url: true } } } },
    },
  },
};

const GIFT_INCLUDE = {
  select: {
    id: true,
    name: true,
    sku: true,
    priceOverride: true,
    product: {
      select: { id: true, name: true, price: true, images: { take: 1, select: { url: true } } },
    },
  },
};

const BOX_INCLUDE = {
  items: { include: ITEM_INCLUDE },
  giftVariant: GIFT_INCLUDE,
};

export async function listMagicBoxes(tenantId: string) {
  const items = await prisma.magicBox.findMany({
    where: { tenantId },
    include: BOX_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return { items };
}

export async function listActiveMagicBoxes(tenantId: string) {
  const items = await prisma.magicBox.findMany({
    where: { tenantId, isActive: true },
    include: BOX_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return { items };
}

export async function createMagicBox(
  tenantId: string,
  data: {
    name: string;
    description?: string;
    giftVariantId?: string;
    items: { variantId: string; quantity: number }[];
  },
) {
  if (data.items.length === 0) throw new AppError(400, "INVALID_INPUT", "Magic Box must have at least one required item");

  const box = await prisma.magicBox.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      giftVariantId: data.giftVariantId,
      items: { create: data.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) },
    },
    include: BOX_INCLUDE,
  });
  return { box };
}

export async function updateMagicBox(
  tenantId: string,
  id: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    giftVariantId?: string | null;
    items?: { variantId: string; quantity: number }[];
  },
) {
  const box = await prisma.magicBox.findUnique({ where: { id } });
  if (!box || box.tenantId !== tenantId) throw new AppError(404, "NOT_FOUND", "Magic Box not found");

  const updated = await prisma.$transaction(async (tx) => {
    if (data.items !== undefined) {
      await tx.magicBoxItem.deleteMany({ where: { magicBoxId: id } });
      await tx.magicBoxItem.createMany({
        data: data.items.map((i) => ({ magicBoxId: id, variantId: i.variantId, quantity: i.quantity })),
      });
    }
    return tx.magicBox.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        giftVariantId: data.giftVariantId,
      },
      include: BOX_INCLUDE,
    });
  });
  return { box: updated };
}

export async function deleteMagicBox(tenantId: string, id: string) {
  const box = await prisma.magicBox.findUnique({ where: { id } });
  if (!box || box.tenantId !== tenantId) throw new AppError(404, "NOT_FOUND", "Magic Box not found");
  await prisma.magicBox.delete({ where: { id } });
}

export async function validateMagicBoxes(
  tenantId: string,
  magicBoxIds: string[],
  orderedItems: { variantId: string; quantity: number }[],
) {
  if (magicBoxIds.length === 0) return [];

  const boxes = await prisma.magicBox.findMany({
    where: { id: { in: magicBoxIds }, tenantId, isActive: true },
    include: { items: true },
  });

  const quantityByVariant = new Map<string, number>();
  for (const item of orderedItems) {
    quantityByVariant.set(item.variantId, (quantityByVariant.get(item.variantId) ?? 0) + item.quantity);
  }

  for (const box of boxes) {
    for (const req of box.items) {
      const have = quantityByVariant.get(req.variantId) ?? 0;
      if (have < req.quantity) {
        throw new AppError(400, "MAGIC_BOX_NOT_EARNED", `Magic Box "${box.name}" requirements not met`);
      }
    }
  }

  return boxes;
}
