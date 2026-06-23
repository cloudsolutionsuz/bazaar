import type { Request, Response } from "express";
import * as platformService from "./platform.service";
import type { ListTenantsQuery, UpdateTenantPlanInput } from "./platform.schema";

export async function listTenants(req: Request, res: Response): Promise<void> {
  const result = await platformService.listTenants(req.query as unknown as ListTenantsQuery);
  res.json(result);
}

export async function getTenantDetail(req: Request, res: Response): Promise<void> {
  const tenant = await platformService.getTenantDetail(req.params.id);
  res.json({ tenant });
}

export async function updateTenantPlan(req: Request, res: Response): Promise<void> {
  const { planId } = req.body as UpdateTenantPlanInput;
  const tenant = await platformService.updateTenantPlan(req.params.id, planId);
  res.json({ tenant });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  const stats = await platformService.getStats();
  res.json(stats);
}
