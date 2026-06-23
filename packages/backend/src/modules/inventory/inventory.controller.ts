import type { Request, Response } from "express";
import type { CreateReceiptInput, ListMovementsQuery } from "./inventory.schema";
import * as inventoryService from "./inventory.service";

export async function createReceipt(req: Request, res: Response): Promise<void> {
  const movement = await inventoryService.createReceipt(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateReceiptInput);
  res.status(201).json({ movement });
}

export async function listMovements(req: Request, res: Response): Promise<void> {
  const result = await inventoryService.listMovements(req.authUser!.tenantId!, req.query as unknown as ListMovementsQuery);
  res.json(result);
}

export async function listLowStock(req: Request, res: Response): Promise<void> {
  const variants = await inventoryService.listLowStock(req.authUser!.tenantId!);
  res.json({ variants });
}
