import type { Request, Response } from "express";
import * as aiAdvisorService from "./aiAdvisor.service";
import type { AskInput } from "./aiAdvisor.schema";

export async function ask(req: Request, res: Response): Promise<void> {
  const answer = await aiAdvisorService.ask(req.authUser!.tenantId!, req.body as AskInput);
  res.json({ answer });
}
