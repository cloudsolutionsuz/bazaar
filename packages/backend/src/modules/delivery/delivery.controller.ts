import type { Request, Response } from "express";
import * as deliveryService from "./delivery.service";
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput, GetShippingCostQuery } from "./delivery.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const zones = await deliveryService.listDeliveryZones(req.authUser!.tenantId!);
  res.json({ zones });
}

export async function create(req: Request, res: Response): Promise<void> {
  const zone = await deliveryService.createDeliveryZone(req.authUser!.tenantId!, req.body as CreateDeliveryZoneInput);
  res.status(201).json({ zone });
}

export async function update(req: Request, res: Response): Promise<void> {
  const zone = await deliveryService.updateDeliveryZone(req.authUser!.tenantId!, req.params.id, req.body as UpdateDeliveryZoneInput);
  res.json({ zone });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deliveryService.deleteDeliveryZone(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}

export async function getShippingCost(req: Request, res: Response): Promise<void> {
  const { region, amount } = req.query as unknown as GetShippingCostQuery;
  const shippingCost = await deliveryService.getShippingCost(req.tenant!.id, region, amount);
  res.json({ shippingCost, region });
}
