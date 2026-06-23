import type { Request, Response } from "express";
import * as financeService from "./finance.service";
import type { AnalyticsQuery, CreateTransactionInput, ListTransactionsQuery, ReportQuery } from "./finance.schema";

export async function getBalance(req: Request, res: Response): Promise<void> {
  const balance = await financeService.getBalance(req.authUser!.tenantId!);
  res.json({ balance });
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await financeService.createTransaction(
    req.authUser!.tenantId!,
    req.authUser!.id,
    req.body as CreateTransactionInput,
  );
  res.status(201).json({ transaction });
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const result = await financeService.listTransactions(req.authUser!.tenantId!, req.query as unknown as ListTransactionsQuery);
  res.json(result);
}

export async function getPnL(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as unknown as ReportQuery;
  const result = await financeService.getPnL(req.authUser!.tenantId!, from, to);
  res.json(result);
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const { from, to, granularity } = req.query as unknown as AnalyticsQuery;
  const result = await financeService.getAnalytics(req.authUser!.tenantId!, from, to, granularity);
  res.json(result);
}
