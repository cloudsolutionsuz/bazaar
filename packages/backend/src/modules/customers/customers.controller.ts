import type { Request, Response } from "express";
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
