import type { Request, Response } from "express";
import * as supportService from "./support.service";

// ── Tenant-facing ──────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  const messages = await supportService.getTenantMessages(req.authUser!.tenantId!);
  res.json({ messages });
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { text } = req.body as { text: string };
  const message = await supportService.sendTenantMessage(req.authUser!.tenantId!, text);
  res.status(201).json({ message });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await supportService.getTenantUnreadCount(req.authUser!.tenantId!);
  res.json({ count });
}

// ── Super admin-facing ─────────────────────────────────────────────────────

export async function listChats(_req: Request, res: Response): Promise<void> {
  const items = await supportService.listSupportChats();
  res.json({ items });
}

export async function getTenantMessages(req: Request, res: Response): Promise<void> {
  const messages = await supportService.getSuperAdminMessages(req.params.tenantId);
  res.json({ messages });
}

export async function replyToTenant(req: Request, res: Response): Promise<void> {
  const { text } = req.body as { text: string };
  const message = await supportService.sendSuperAdminMessage(req.params.tenantId, text);
  res.status(201).json({ message });
}

export async function getSuperAdminUnreadCount(_req: Request, res: Response): Promise<void> {
  const count = await supportService.getSuperAdminUnreadCount();
  res.json({ count });
}
