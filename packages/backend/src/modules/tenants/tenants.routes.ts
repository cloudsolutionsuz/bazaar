import { Router } from "express";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
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
