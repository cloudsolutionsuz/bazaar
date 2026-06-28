import type { Request, Response } from "express";
import * as financeService from "./finance.service";
import type {
  AnalyticsQuery,
  BalanceQuery,
  ConfirmTransactionInput,
  CreateTransactionInput,
  DailySummaryQuery,
  ForecastQuery,
  ListPendingTransactionsQuery,
  ListTransactionsQuery,
  ReportQuery,
} from "./finance.schema";

export async function getBalance(req: Request, res: Response): Promise<void> {
  const { cashRegisterId } = req.query as unknown as BalanceQuery;
  const balance = await financeService.getBalance(req.authUser!.tenantId!, cashRegisterId);
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

export async function exportAnalytics(req: Request, res: Response): Promise<void> {
  const { from, to, granularity } = req.query as unknown as AnalyticsQuery;
  const buffer = await financeService.exportAnalyticsToExcel(req.authUser!.tenantId!, from, to, granularity ?? "day");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=analytics.xlsx");
  res.send(buffer);
}

export async function exportPnL(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as unknown as ReportQuery;
  const buffer = await financeService.exportPnLToExcel(req.authUser!.tenantId!, from, to);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=pnl.xlsx");
  res.send(buffer);
}

export async function getForecast(req: Request, res: Response): Promise<void> {
  const { horizonDays } = req.query as unknown as ForecastQuery;
  const result = await financeService.getSalesForecast(req.authUser!.tenantId!, horizonDays === 60 ? 60 : 30);
  res.json(result);
}

export async function listPendingTransactions(req: Request, res: Response): Promise<void> {
  const items = await financeService.listPendingTransactions(
    req.authUser!.tenantId!,
    req.query as unknown as ListPendingTransactionsQuery,
  );
  res.json({ items });
}

export async function confirmTransaction(req: Request, res: Response): Promise<void> {
  const { cashRegisterId } = req.body as ConfirmTransactionInput;
  const transaction = await financeService.confirmTransaction(req.authUser!.tenantId!, req.params.id, cashRegisterId);
  res.json({ transaction });
}

export async function getDailySummary(req: Request, res: Response): Promise<void> {
  const result = await financeService.getDailySummary(req.authUser!.tenantId!, req.query as unknown as DailySummaryQuery);
  res.json(result);
}
