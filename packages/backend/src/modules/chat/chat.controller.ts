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

export async function getPushVapidKey(_req: Request, res: Response): Promise<void> {
  res.json(chatService.getAdminPushVapidKey());
}

export async function subscribePush(req: Request, res: Response): Promise<void> {
  const { endpoint, p256dh, auth } = req.body as { endpoint: string; p256dh: string; auth: string };
  await chatService.subscribeAdminPush(req.authUser!.tenantId!, req.authUser!.id, { endpoint, p256dh, auth });
  res.json({ ok: true });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await chatService.getUnreadCount(req.authUser!.tenantId!);
  res.json({ count });
}
