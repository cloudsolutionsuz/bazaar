import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput } from "./delivery.schema";

export async function listDeliveryZones(tenantId: string) {
  return prisma.deliveryZone.findMany({
    where: { tenantId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function createDeliveryZone(tenantId: string, input: CreateDeliveryZoneInput) {
  return prisma.deliveryZone.create({
    data: { tenantId, ...input, position: input.position ?? 0 },
  });
}

export async function updateDeliveryZone(tenantId: string, id: string, input: UpdateDeliveryZoneInput) {
  const zone = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
  if (!zone) throw new AppError(404, "NOT_FOUND", "Delivery zone not found");
  return prisma.deliveryZone.update({ where: { id }, data: input });
}

export async function deleteDeliveryZone(tenantId: string, id: string) {
  const zone = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
  if (!zone) throw new AppError(404, "NOT_FOUND", "Delivery zone not found");
  await prisma.deliveryZone.delete({ where: { id } });
}

export async function getShippingCost(tenantId: string, region: string, orderAmount: number): Promise<number> {
  const zones = await prisma.deliveryZone.findMany({
    where: { tenantId, isActive: true, regions: { has: region } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (zones.length === 0) return 0;
  const zone = zones[0];
  if (zone.freeAbove !== null && orderAmount >= zone.freeAbove) return 0;
  return zone.cost;
}
