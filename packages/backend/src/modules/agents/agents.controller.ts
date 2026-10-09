import type { Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import * as agentsService from "./agents.service";
import * as reportsService from "./agents.reports.service";
import type {
  AgentPeriodQuery,
  AgentSalesQuery,
  BulkBonusInput,
  CreateAgentInput,
  CreatePayoutInput,
  UpdateAgentInput,
} from "./agents.schema";

// The report endpoints are shared by staff and agents. For an AGENT login
// this returns the one agent they are allowed to see; staff get undefined
// (= no restriction).
function agentScope(req: Request): string | undefined {
  if (req.authUser!.role !== "AGENT") return undefined;
  if (!req.authUser!.agentId) {
    throw new AppError(403, "FORBIDDEN", "No agent profile is linked to this login");
  }
  return req.authUser!.agentId;
}

export async function list(req: Request, res: Response): Promise<void> {
  const agents = await agentsService.listAgents(req.authUser!.tenantId!);
  res.json({ agents });
}

export async function me(req: Request, res: Response): Promise<void> {
  const agentId = agentScope(req);
  if (!agentId) {
    throw new AppError(403, "FORBIDDEN", "Only agents have an agent profile");
  }
  const agent = await agentsService.getAgent(req.authUser!.tenantId!, agentId);
  res.json({ agent });
}

export async function create(req: Request, res: Response): Promise<void> {
  const agent = await agentsService.createAgent(req.authUser!.tenantId!, req.body as CreateAgentInput);
  res.status(201).json({ agent });
}

export async function update(req: Request, res: Response): Promise<void> {
  const agent = await agentsService.updateAgent(req.authUser!.tenantId!, req.params.id, req.body as UpdateAgentInput);
  res.json({ agent });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await agentsService.deleteAgent(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}

export async function bulkBonus(req: Request, res: Response): Promise<void> {
  const result = await agentsService.bulkSetBonus(req.authUser!.tenantId!, req.body as BulkBonusInput);
  res.json(result);
}

export async function unpaidOrders(req: Request, res: Response): Promise<void> {
  const result = await agentsService.getUnpaidOrders(req.authUser!.tenantId!, req.params.id);
  res.json(result);
}

export async function createPayout(req: Request, res: Response): Promise<void> {
  const result = await agentsService.createPayout(
    req.authUser!.tenantId!,
    req.authUser!.id,
    req.params.id,
    req.body as CreatePayoutInput,
  );
  res.status(201).json(result);
}

export async function sales(req: Request, res: Response): Promise<void> {
  const result = await reportsService.getSales(req.authUser!.tenantId!, req.query as unknown as AgentSalesQuery, agentScope(req));
  res.json(result);
}

export async function payouts(req: Request, res: Response): Promise<void> {
  const result = await reportsService.getPayouts(req.authUser!.tenantId!, req.query as unknown as AgentPeriodQuery, agentScope(req));
  res.json(result);
}

export async function reconciliation(req: Request, res: Response): Promise<void> {
  const result = await reportsService.getReconciliation(
    req.authUser!.tenantId!,
    req.query as unknown as AgentPeriodQuery,
    agentScope(req),
  );
  res.json(result);
}

export async function exportReconciliation(req: Request, res: Response): Promise<void> {
  const buffer = await reportsService.exportReconciliationToExcel(
    req.authUser!.tenantId!,
    req.query as unknown as AgentPeriodQuery,
    agentScope(req),
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=akt-sverka.xlsx");
  res.send(buffer);
}
