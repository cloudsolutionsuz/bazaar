import { Router } from "express";
import { prisma } from "../../db/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { createPlanSchema, updatePlanSchema, type CreatePlanInput, type UpdatePlanInput } from "./plans.schema";

export const plansRouter = Router();

plansRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ orderBy: { priceSum: "asc" } });
    res.json({ plans });
  }),
);

plansRouter.post(
  "/",
  requireAuth(),
  requireRole("SUPER_ADMIN"),
  validateBody(createPlanSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as CreatePlanInput;
    const plan = await prisma.plan.create({ data: { ...input, features: input.features ?? {} } });
    res.status(201).json({ plan });
  }),
);

plansRouter.patch(
  "/:id",
  requireAuth(),
  requireRole("SUPER_ADMIN"),
  validateBody(updatePlanSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as UpdatePlanInput;
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: input });
    res.json({ plan });
  }),
);
