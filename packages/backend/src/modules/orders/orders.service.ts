import ExcelJS from "exceljs";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { assertWithinPlanLimit } from "../plans/limits";
import type { CreateOrderInput, ListOrdersQuery } from "./orders.schema";

const orderInclude = {
  items: { include: { variant: { include: { product: true } } } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
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
    ...(query.status ? { status: query.status } : {}),
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
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createOrder(tenantId: string, userId: string, input: CreateOrderInput) {
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
    const unitPrice = variant.priceOverride ?? variant.product.price;
    return { variantId: item.variantId, quantity: item.quantity, unitPrice, totalPrice: unitPrice * item.quantity };
  });

  const totalAmount = orderItemsData.reduce((sum, i) => sum + i.totalPrice, 0);

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

    const order = await tx.order.create({
      data: {
        tenantId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
        paymentMethod: input.paymentMethod,
        totalAmount,
        items: { create: orderItemsData },
      },
    });

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

    return order.id;
  });

  return getOrder(tenantId, orderId);
}

export async function updateOrderStatus(tenantId: string, userId: string, orderId: string, nextStatus: OrderStatus) {
  const order = await getOrder(tenantId, orderId);

  if (order.status === nextStatus) {
    throw new AppError(400, "INVALID_TRANSITION", `Order is already ${nextStatus}`);
  }
  if (!ALLOWED_TRANSITIONS[order.status].includes(nextStatus)) {
    throw new AppError(400, "INVALID_TRANSITION", `Cannot transition from ${order.status} to ${nextStatus}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
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
    }
  });

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
  sheet.addRow(["Order ID", "Date", "Customer", "Phone", "Status", "Payment Method", "Items", "Total Amount"]);

  for (const order of orders) {
    const itemsSummary = order.items.map((i) => `${i.variant.sku} x${i.quantity}`).join(", ");
    sheet.addRow([
      order.id,
      order.createdAt.toISOString(),
      order.customerName,
      order.customerPhone,
      order.status,
      order.paymentMethod ?? "",
      itemsSummary,
      order.totalAmount,
    ]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
