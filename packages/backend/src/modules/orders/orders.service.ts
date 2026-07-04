import ExcelJS from "exceljs";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { assertWithinPlanLimit } from "../plans/limits";
import { notifyLowStock, notifyNewOrder } from "../../utils/notifications";
import { pushToCustomer } from "../storefront/storefront.service";
import { validatePromoCode } from "../promo-codes/promo-codes.service";
import { getShippingCost } from "../delivery/delivery.service";
import type { CreateOrderInput, ListOrdersQuery } from "./orders.schema";

const orderInclude = {
  items: { include: { variant: { include: { product: true } } } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
};

// Admin can archive any order at any stage (organizational cleanup). For active
// orders the business flow still shows only the forward transitions, but the
// admin list page lets staff archive test/junk orders without stepping through
// every intermediate status.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PROCESSING", "CANCELLED", "ARCHIVED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "ARCHIVED"],
  SHIPPED: ["DELIVERED", "REFUNDED", "ARCHIVED"],
  DELIVERED: ["REFUNDED", "ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  REFUNDED: ["ARCHIVED"],
  ARCHIVED: [],
};

const RESTOCKING_STATUSES = new Set<OrderStatus>(["CANCELLED", "REFUNDED"]);

export async function getOrder(tenantId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId }, include: orderInclude });
  if (!order) {
    throw new AppError(404, "NOT_FOUND", "Order not found");
  }
  return order;
}

export async function listOrders(tenantId: string, query: ListOrdersQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.OrderWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : query.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.minAmount !== undefined || query.maxAmount !== undefined
      ? {
          totalAmount: {
            ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
            ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

// userId is null for storefront-originated orders (no staff member involved) -
// propagated to OrderStatusHistory/InventoryMovement, both of which allow null.
// minOrderAmount enforces a cart floor for storefront orders (0 = no limit).
export async function createOrder(tenantId: string, userId: string | null, input: CreateOrderInput, minOrderAmount = 0) {
  await assertWithinPlanLimit(tenantId, "orders");

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, tenantId },
    include: { product: true },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  for (const item of input.items) {
    if (!variantById.has(item.variantId)) {
      throw new AppError(400, "INVALID_VARIANT", `Variant ${item.variantId} not found`);
    }
  }

  const orderItemsData = input.items.map((item) => {
    const variant = variantById.get(item.variantId)!;
    const basePrice = variant.priceOverride ?? variant.product.price;
    // discountPercent is shown to shoppers on the storefront, so the charged
    // price must match it rather than billing the pre-discount price.
    const unitPrice = variant.product.discountPercent
      ? Math.round(basePrice * (1 - variant.product.discountPercent / 100))
      : basePrice;
    return { variantId: item.variantId, quantity: item.quantity, unitPrice, totalPrice: unitPrice * item.quantity };
  });

  const subtotal = orderItemsData.reduce((sum, i) => sum + i.totalPrice, 0);

  if (minOrderAmount > 0 && subtotal < minOrderAmount) {
    throw new AppError(400, "MIN_ORDER_AMOUNT", `Minimum order amount is ${minOrderAmount}`);
  }

  let promoCodeId: string | undefined;
  let discountAmount = 0;
  if (input.promoCode) {
    const promo = await validatePromoCode(tenantId, input.promoCode, subtotal);
    promoCodeId = promo.promoCodeId;
    discountAmount = promo.discountAmount;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramChatId: true, loyaltyEnabled: true, loyaltyPointsRate: true, loyaltyMinRedeem: true },
  });

  let loyaltyPointsRedeemed = 0;
  let customerId: string | null = null;

  const preLoyaltyTotal = subtotal - discountAmount;
  const shippingCost = await getShippingCost(tenantId, input.addressRegion, preLoyaltyTotal);

  if (tenant?.loyaltyEnabled && (input.loyaltyPointsToRedeem ?? 0) > 0) {
    const existingCustomer = await prisma.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone: input.customerPhone } },
      select: { id: true, loyaltyPoints: true },
    });
    if (existingCustomer) {
      customerId = existingCustomer.id;
      const requested = input.loyaltyPointsToRedeem!;
      const available = existingCustomer.loyaltyPoints;
      const minRedeem = tenant.loyaltyMinRedeem ?? 0;
      if (available >= minRedeem && available > 0) {
        loyaltyPointsRedeemed = Math.min(requested, available, preLoyaltyTotal + shippingCost);
      }
    }
  }

  const loyaltyPointsEarned = tenant?.loyaltyEnabled
    ? Math.round(preLoyaltyTotal * (tenant.loyaltyPointsRate ?? 1) / 100)
    : 0;
  const totalAmount = preLoyaltyTotal + shippingCost - loyaltyPointsRedeemed;

  const orderId = await prisma.$transaction(async (tx) => {
    // Atomic, race-safe stock guard: only decrements if enough stock is
    // still available at the moment of the update, so concurrent orders
    // can't oversell the same variant.
    for (const item of orderItemsData) {
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, tenantId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        const variant = variantById.get(item.variantId)!;
        throw new AppError(409, "INSUFFICIENT_STOCK", `Not enough stock for SKU "${variant.sku}"`);
      }
    }

    // Customer is the buyer's "mini-account" - no OTP, just a phone-number
    // identity so they can later look up their own order history. Reused by
    // both storefront checkout and staff-created orders, so any order with
    // this phone gets attributed to the same customer regardless of channel.
    const customer = await tx.customer.upsert({
      where: { tenantId_phone: { tenantId, phone: input.customerPhone } },
      update: {
        name: input.customerName,
        addressRegion: input.addressRegion,
        addressDistrict: input.addressDistrict,
        addressMahalla: input.addressMahalla,
      },
      create: {
        tenantId,
        phone: input.customerPhone,
        name: input.customerName,
        addressRegion: input.addressRegion,
        addressDistrict: input.addressDistrict,
        addressMahalla: input.addressMahalla,
      },
    });

    const order = await tx.order.create({
      data: {
        tenantId,
        customerId: customer.id,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        additionalPhones: input.additionalPhones ?? [],
        addressRegion: input.addressRegion,
        addressDistrict: input.addressDistrict,
        addressMahalla: input.addressMahalla,
        addressNote: input.addressNote,
        paymentMethod: input.paymentMethod,
        promoCodeId,
        discountAmount,
        shippingCost,
        loyaltyPointsEarned,
        loyaltyPointsRedeemed,
        totalAmount,
        items: { create: orderItemsData },
      },
    });

    if (promoCodeId) {
      await tx.promoCode.update({
        where: { id: promoCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (loyaltyPointsRedeemed > 0 || loyaltyPointsEarned > 0) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: {
            decrement: loyaltyPointsRedeemed,
          },
        },
      });
      if (loyaltyPointsEarned > 0) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { loyaltyPoints: { increment: loyaltyPointsEarned } },
        });
      }
    }

    await tx.orderStatusHistory.create({ data: { orderId: order.id, toStatus: "NEW", changedByUserId: userId } });

    for (const item of orderItemsData) {
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          variantId: item.variantId,
          type: "SALE",
          quantity: -item.quantity,
          orderId: order.id,
          createdByUserId: userId,
        },
      });
    }

    // Starts PENDING, not CONFIRMED: money from a sale doesn't count toward
    // the real Kassa balance until a cashier actively confirms it by looking
    // the buyer up (see finance.service.ts's confirmTransaction) - a manual
    // Kassa entry is its own confirmation and stays CONFIRMED by default.
    await tx.transaction.create({
      data: {
        tenantId,
        type: "INCOME",
        status: "PENDING",
        category: "Продажа",
        amount: totalAmount,
        orderId: order.id,
        customerId: customer.id,
        createdByUserId: userId,
      },
    });

    return order.id;
  });

  const chatId = tenant?.telegramChatId ?? null;

  await notifyNewOrder(chatId, input.customerName, totalAmount);

  for (const item of orderItemsData) {
    const variant = variantById.get(item.variantId)!;
    const stockBefore = variant.stockQuantity;
    const stockAfter = stockBefore - item.quantity;
    const threshold = variant.lowStockThreshold;
    if (threshold !== null && stockBefore > threshold && stockAfter <= threshold) {
      await notifyLowStock(chatId, variant.sku, stockAfter);
    }
  }

  return getOrder(tenantId, orderId);
}

export async function updateOrderStatus(
  tenantId: string,
  userId: string,
  orderId: string,
  nextStatus: OrderStatus,
  courierName?: string,
) {
  const order = await getOrder(tenantId, orderId);

  if (order.status === nextStatus) {
    throw new AppError(400, "INVALID_TRANSITION", `Order is already ${nextStatus}`);
  }
  if (!ALLOWED_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new AppError(400, "INVALID_TRANSITION", `Cannot transition from ${order.status} to ${nextStatus}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus, ...(courierName !== undefined ? { courierName } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: nextStatus, changedByUserId: userId },
    });

    if (RESTOCKING_STATUSES.has(nextStatus)) {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            variantId: item.variantId,
            type: "RETURN",
            quantity: item.quantity,
            orderId,
            createdByUserId: userId,
          },
        });
      }

      // Reverses the INCOME transaction created at order time - but only if
      // it was actually CONFIRMED (real money the balance already counted).
      // If the cashier never confirmed it, it was never in the balance, so
      // reversing it would incorrectly subtract money that was never added -
      // just delete the still-pending transaction instead.
      const incomeTransaction = await tx.transaction.findFirst({ where: { orderId, type: "INCOME" } });
      if (incomeTransaction?.status === "CONFIRMED") {
        await tx.transaction.create({
          data: {
            tenantId,
            type: "EXPENSE",
            category: "Возврат",
            amount: order.totalAmount,
            orderId,
            cashRegisterId: incomeTransaction.cashRegisterId,
            createdByUserId: userId,
          },
        });
      } else if (incomeTransaction) {
        await tx.transaction.delete({ where: { id: incomeTransaction.id } });
      }

      if (order.customerId && (order.loyaltyPointsEarned > 0 || order.loyaltyPointsRedeemed > 0)) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            loyaltyPoints: {
              decrement: order.loyaltyPointsEarned,
              increment: order.loyaltyPointsRedeemed,
            },
          },
        });
      }
    }
  });

  const ORDER_PUSH_MESSAGES: Partial<Record<OrderStatus, { title: string; body: string }>> = {
    SHIPPED: { title: "Ваш заказ отправлен", body: "Заказ передан курьеру и скоро прибудет." },
    DELIVERED: { title: "Заказ доставлен", body: "Ваш заказ успешно доставлен. Спасибо за покупку!" },
    CANCELLED: { title: "Заказ отменён", body: "К сожалению, ваш заказ был отменён." },
    REFUNDED: { title: "Возврат оформлен", body: "По вашему заказу оформлен возврат." },
  };

  const pushMsg = ORDER_PUSH_MESSAGES[nextStatus];
  if (pushMsg) {
    await pushToCustomer(tenantId, order.customerPhone, pushMsg.title, pushMsg.body).catch(() => {});
  }

  return getOrder(tenantId, orderId);
}

export async function exportOrdersToExcel(tenantId: string): Promise<Buffer> {
  const orders = await prisma.order.findMany({
    where: { tenantId },
    include: { items: { include: { variant: true } } },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");
  sheet.addRow([
    "Order ID",
    "Date",
    "Customer",
    "Phone",
    "Additional Phones",
    "Region",
    "District",
    "Mahalla",
    "Address Note",
    "Status",
    "Courier",
    "Payment Method",
    "Items",
    "Total Amount",
  ]);

  for (const order of orders) {
    const itemsSummary = order.items.map((i) => `${i.variant.sku} x${i.quantity}`).join(", ");
    sheet.addRow([
      order.id,
      order.createdAt.toISOString(),
      order.customerName,
      order.customerPhone,
      order.additionalPhones.join(", "),
      order.addressRegion ?? "",
      order.addressDistrict ?? "",
      order.addressMahalla ?? "",
      order.addressNote ?? "",
      order.status,
      order.courierName ?? "",
      order.paymentMethod ?? "",
      itemsSummary,
      order.totalAmount,
    ]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
