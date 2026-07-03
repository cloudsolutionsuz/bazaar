import type { Request, Response } from "express";
import { z } from "zod";
import * as customersService from "./customers.service";
import type { ListCustomersQuery } from "./customers.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await customersService.listCustomers(req.authUser!.tenantId!, req.query as unknown as ListCustomersQuery);
  res.json(result);
}

export async function get(req: Request, res: Response): Promise<void> {
  const customer = await customersService.getCustomer(req.authUser!.tenantId!, req.params.id);
  res.json({ customer });
}

export async function exportCustomers(req: Request, res: Response): Promise<void> {
  const buffer = await customersService.exportCustomersToExcel(req.authUser!.tenantId!);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=customers.xlsx");
  res.send(buffer);
}

const adjustLoyaltySchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(200).optional().default(""),
});

export async function adjustLoyalty(req: Request, res: Response): Promise<void> {
  const { delta, reason } = adjustLoyaltySchema.parse(req.body);
  const customer = await customersService.adjustLoyaltyPoints(
    req.authUser!.tenantId!,
    req.params.id,
    delta,
    reason,
  );
  res.json({ customer });
}
