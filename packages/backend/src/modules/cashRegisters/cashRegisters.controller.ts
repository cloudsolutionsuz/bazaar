import type { Request, Response } from "express";
import * as cashRegistersService from "./cashRegisters.service";
import type { CreateCashRegisterInput, UpdateCashRegisterInput } from "./cashRegisters.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const items = await cashRegistersService.listCashRegisters(req.authUser!.tenantId!);
  res.json({ items });
}

export async function create(req: Request, res: Response): Promise<void> {
  const cashRegister = await cashRegistersService.createCashRegister(req.authUser!.tenantId!, req.body as CreateCashRegisterInput);
  res.status(201).json({ cashRegister });
}

export async function update(req: Request, res: Response): Promise<void> {
  const cashRegister = await cashRegistersService.updateCashRegister(
    req.authUser!.tenantId!,
    req.params.id,
    req.body as UpdateCashRegisterInput,
  );
  res.json({ cashRegister });
}
