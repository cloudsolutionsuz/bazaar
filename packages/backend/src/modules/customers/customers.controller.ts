import type { Request, Response } from "express";
import * as customersService from "./customers.service";
import type { ListCustomersQuery } from "./customers.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await customersService.listCustomers(req.authUser!.tenantId!, req.query as unknown as ListCustomersQuery);
  res.json(result);
}
