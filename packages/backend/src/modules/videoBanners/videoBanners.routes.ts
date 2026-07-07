import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import * as svc from "./videoBanners.service";

export const videoBannersRouter = Router();

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  videoUrl: z.string().url(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const patchSchema = bodySchema.partial();

// Public — used by landing page
videoBannersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await svc.listActiveVideoBanners();
    res.json({ items });
  }),
);

// SUPER_ADMIN management
videoBannersRouter.use(requireAuth(), requireRole("SUPER_ADMIN"));

videoBannersRouter.get(
  "/all",
  asyncHandler(async (_req, res) => {
    const items = await svc.listVideoBanners();
    res.json({ items });
  }),
);

videoBannersRouter.post(
  "/",
  validateBody(bodySchema),
  asyncHandler(async (req, res) => {
    const item = await svc.createVideoBanner(req.body as z.infer<typeof bodySchema>);
    res.status(201).json({ item });
  }),
);

videoBannersRouter.patch(
  "/:id",
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const item = await svc.updateVideoBanner(req.params.id, req.body as z.infer<typeof patchSchema>);
    res.json({ item });
  }),
);

videoBannersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await svc.deleteVideoBanner(req.params.id);
    res.json({ ok: true });
  }),
);
