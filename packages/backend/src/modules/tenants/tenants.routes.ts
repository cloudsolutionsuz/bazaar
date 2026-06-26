import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { uploadLogoImage } from "../../middleware/upload";
import { saveCompressedImage, deleteStoredImage } from "../../utils/imageStorage";
import { AppError } from "../../middleware/errorHandler";
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
  telegramChatId: z.string().trim().max(64).nullable().optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

tenantsRouter.patch(
  "/me",
  requireAuth(),
  requireRole("OWNER"),
  validateBody(updateMySettingsSchema),
  asyncHandler(async (req, res) => {
    const { telegramChatId, themeColor, description } = req.body as z.infer<typeof updateMySettingsSchema>;
    const tenant = await prisma.tenant.update({
      where: { id: req.authUser!.tenantId! },
      data: {
        ...(telegramChatId !== undefined ? { telegramChatId: telegramChatId || null } : {}),
        ...(themeColor !== undefined ? { themeColor } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
      },
    });
    res.json({ tenant });
  }),
);

tenantsRouter.post(
  "/me/logo",
  requireAuth(),
  requireRole("OWNER"),
  uploadLogoImage,
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new AppError(400, "NO_FILE", "No image file was uploaded");
    }
    const existing = await prisma.tenant.findUnique({ where: { id: req.authUser!.tenantId! } });
    const logoUrl = await saveCompressedImage(file.buffer);
    if (existing?.logoUrl) {
      await deleteStoredImage(existing.logoUrl);
    }
    const tenant = await prisma.tenant.update({
      where: { id: req.authUser!.tenantId! },
      data: { logoUrl },
    });
    res.json({ tenant });
  }),
);
