import type { Request, Response } from "express";
import * as suppliersService from "./suppliers.service";
import type { CreateSupplierInput, ListSuppliersQuery, UpdateSupplierInput } from "./suppliers.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await suppliersService.listSuppliers(req.authUser!.tenantId!, req.query as unknown as ListSuppliersQuery);
  res.json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const supplier = await suppliersService.createSupplier(req.authUser!.tenantId!, req.body as CreateSupplierInput);
  res.status(201).json({ supplier });
}

export async function update(req: Request, res: Response): Promise<void> {
  const supplier = await suppliersService.updateSupplier(req.authUser!.tenantId!, req.params.id, req.body as UpdateSupplierInput);
  res.json({ supplier });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await suppliersService.deleteSupplier(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}
