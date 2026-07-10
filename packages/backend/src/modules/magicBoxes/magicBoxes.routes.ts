import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import * as svc from "./magicBoxes.service";

export const magicBoxesRouter = Router();

magicBoxesRouter.use(requireAuth());
magicBoxesRouter.use(requireRole("OWNER", "MANAGER"));

magicBoxesRouter.get("/", asyncHandler(async (req, res) => {
  res.json(await svc.listMagicBoxes(req.authUser!.tenantId!));
}));

magicBoxesRouter.post("/", asyncHandler(async (req, res) => {
  const { name, description, items } = req.body as { name: string; description?: string; items: { variantId: string; quantity: number }[] };
  res.status(201).json(await svc.createMagicBox(req.authUser!.tenantId!, { name, description, items }));
}));

magicBoxesRouter.patch("/:id", asyncHandler(async (req, res) => {
  res.json(await svc.updateMagicBox(req.authUser!.tenantId!, req.params.id, req.body));
}));

magicBoxesRouter.delete("/:id", asyncHandler(async (req, res) => {
  await svc.deleteMagicBox(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}));
