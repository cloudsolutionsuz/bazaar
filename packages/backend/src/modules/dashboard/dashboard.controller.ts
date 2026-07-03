import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as { from?: string; to?: string };
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  const summary = await dashboardService.getSummary(req.authUser!.tenantId!, fromDate, toDate);
  res.json(summary);
}
