import { Router } from "express";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

export const plansRouter = Router();

plansRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ orderBy: { priceSum: "asc" } });
    res.json({ plans });
  }),
);
