import type { Request, Response } from "express";
import * as platformService from "./platform.service";
import * as financeService from "../finance/finance.service";
import * as customersService from "../customers/customers.service";
import type { ListTenantsQuery, UpdateTenantPlanInput, UpdateTenantVipInput } from "./platform.schema";

function parseDateRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const { from, to } = query as { from?: string; to?: string };
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

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

export async function updateTenantVip(req: Request, res: Response): Promise<void> {
  const { isVip } = req.body as UpdateTenantVipInput;
  const tenant = await platformService.updateTenantVip(req.params.id, isVip);
  res.json({ tenant });
}

export async function getBillingTimeline(req: Request, res: Response): Promise<void> {
  const result = await platformService.getBillingTimeline(req.query as unknown as ListTenantsQuery);
  res.json(result);
}

export async function getTenantReports(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.id;
  const { from, to } = parseDateRange(req.query);

  const [analytics, payments] = await Promise.all([
    financeService.getAnalytics(tenantId, from, to, "day"),
    financeService.listTransactions(tenantId, { type: "INCOME", pageSize: 100 }),
  ]);

  res.json({ analytics, payments: payments.items });
}

export async function getTenantProductsReport(req: Request, res: Response): Promise<void> {
  const { from, to } = parseDateRange(req.query);
  const products = await financeService.getProductSalesReport(req.params.id, from, to);
  res.json({ products });
}

export async function getTenantPaymentsReport(req: Request, res: Response): Promise<void> {
  const { from, to } = parseDateRange(req.query);
  const items = await customersService.getPaymentsReport(req.params.id, from, to);
  res.json({ items });
}
