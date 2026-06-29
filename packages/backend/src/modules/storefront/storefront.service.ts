import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { notifyNewChatMessage } from "../../utils/notifications";
import { normalizePhone } from "../../utils/phone";
import type { ListStorefrontProductsQuery, SendChatMessageInput, TrackPageViewInput } from "./storefront.schema";

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
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? { price: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) } }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sort === "price_asc" ? { price: "asc" } : query.sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
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

export function trackPageView(tenantId: string, input: TrackPageViewInput) {
  return prisma.pageView.create({
    data: { tenantId, sessionId: input.sessionId, path: input.path },
  });
}

// No OTP/verification by design - phone number alone is the buyer's
// "mini-account" identity. Anyone who knows the phone number can see that
// number's order history for this shop; this is a deliberate low-friction
// trade-off, not an oversight.
export async function getMyOrders(tenantId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const customer = await prisma.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { variant: { include: { product: true } } } } },
      },
    },
  });
  return customer?.orders ?? [];
}

export async function getChatMessages(tenantId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const customer = await prisma.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    include: { chatMessages: { orderBy: { createdAt: "asc" } } },
  });
  return customer?.chatMessages ?? [];
}

// Same phone-only "mini-account" identity as orders - starting a chat is
// itself a customer-acquisition action, so it upserts a Customer exactly
// like checkout does, rather than requiring a prior order to exist first.
export async function sendChatMessage(tenantId: string, input: SendChatMessageInput) {
  const phone = normalizePhone(input.phone);

  const message = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { name: input.name },
      create: { tenantId, phone, name: input.name },
    });

    return tx.chatMessage.create({
      data: { tenantId, customerId: customer.id, sender: "CUSTOMER", text: input.text },
    });
  });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { telegramChatId: true } });
  await notifyNewChatMessage(tenant?.telegramChatId ?? null, input.name, input.text);

  return message;
}
