import type { Request, Response } from "express";
import type {
  CreateReceiptInput,
  CreateStocktakeInput,
  CreateSupplierReturnInput,
  CreateWriteOffInput,
  DailyReportQuery,
  ListMovementsQuery,
} from "./inventory.schema";
import * as inventoryService from "./inventory.service";

export async function createReceipt(req: Request, res: Response): Promise<void> {
  const movement = await inventoryService.createReceipt(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateReceiptInput);
  res.status(201).json({ movement });
}

export async function createWriteOff(req: Request, res: Response): Promise<void> {
  const movement = await inventoryService.createWriteOff(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateWriteOffInput);
  res.status(201).json({ movement });
}

export async function createSupplierReturn(req: Request, res: Response): Promise<void> {
  const movement = await inventoryService.createSupplierReturn(
    req.authUser!.tenantId!,
    req.authUser!.id,
    req.body as CreateSupplierReturnInput,
  );
  res.status(201).json({ movement });
}

export async function createStocktake(req: Request, res: Response): Promise<void> {
  const movement = await inventoryService.createStocktake(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateStocktakeInput);
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

export async function getDailyReport(req: Request, res: Response): Promise<void> {
  const rows = await inventoryService.getDailyReport(req.authUser!.tenantId!, req.query as unknown as DailyReportQuery);
  res.json({ rows });
}

export async function exportInventory(req: Request, res: Response): Promise<void> {
  const buffer = await inventoryService.exportInventoryToExcel(req.authUser!.tenantId!);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=inventory.xlsx");
  res.send(buffer);
}
