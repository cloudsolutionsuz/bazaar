import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await dashboardService.getSummary(req.authUser!.tenantId!);
  res.json(summary);
}
