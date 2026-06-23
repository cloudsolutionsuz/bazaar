import type { Request, Response } from "express";
import * as employeesService from "./employees.service";
import type { InviteEmployeeInput, UpdateEmployeeInput } from "./employees.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const employees = await employeesService.listEmployees(req.authUser!.tenantId!);
  res.json({ employees });
}

export async function invite(req: Request, res: Response): Promise<void> {
  const employee = await employeesService.inviteEmployee(req.authUser!.tenantId!, req.body as InviteEmployeeInput);
  res.status(201).json({ employee });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const employee = await employeesService.updateEmployeeRole(
    req.authUser!.tenantId!,
    req.params.id,
    req.body as UpdateEmployeeInput,
  );
  res.json({ employee });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await employeesService.removeEmployee(req.authUser!.tenantId!, req.params.id, req.authUser!.id);
  res.status(204).send();
}
