import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { isValidSubdomain } from "./constants";

export const tenantsRouter = Router();

tenantsRouter.get(
  "/check-subdomain",
  asyncHandler(async (req, res) => {
    const value = String(req.query.value ?? "").toLowerCase();

    if (!isValidSubdomain(value)) {
      res.json({ available: false, reason: "INVALID" });
      return;
    }

    const existing = await prisma.tenant.findUnique({ where: { subdomain: value } });
    res.json({ available: !existing, reason: existing ? "TAKEN" : undefined });
  }),
);

const updateMySettingsSchema = z.object({
  telegramChatId: z.string().trim().max(64).nullable(),
});

tenantsRouter.patch(
  "/me",
  requireAuth(),
  requireRole("OWNER"),
  validateBody(updateMySettingsSchema),
  asyncHandler(async (req, res) => {
    const telegramChatId = (req.body.telegramChatId as string | null) || null;
    const tenant = await prisma.tenant.update({
      where: { id: req.authUser!.tenantId! },
      data: { telegramChatId },
    });
    res.json({ tenant });
  }),
);
