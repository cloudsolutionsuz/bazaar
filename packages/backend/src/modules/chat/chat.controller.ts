import type { Request, Response } from "express";
import * as chatService from "./chat.service";
import type { SendStaffMessageInput } from "./chat.schema";

export async function listThreads(req: Request, res: Response): Promise<void> {
  const items = await chatService.listThreads(req.authUser!.tenantId!);
  res.json({ items });
}

export async function getThreadMessages(req: Request, res: Response): Promise<void> {
  const result = await chatService.getThreadMessages(req.authUser!.tenantId!, req.params.customerId);
  res.json(result);
}

export async function sendStaffMessage(req: Request, res: Response): Promise<void> {
  const { text } = req.body as SendStaffMessageInput;
  const message = await chatService.sendStaffMessage(req.authUser!.tenantId!, req.authUser!.id, req.params.customerId, text);
  res.status(201).json({ message });
}
