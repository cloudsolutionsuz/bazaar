import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import * as supportController from "./support.controller";

export const supportRouter = Router();

const sendMessageSchema = z.object({ text: z.string().min(1).max(5000) });

// Tenant-facing endpoints (OWNER / MANAGER only)
supportRouter.use(requireAuth(), requireRole("OWNER", "MANAGER"));

supportRouter.get("/messages", asyncHandler(supportController.getMessages));
supportRouter.post("/messages", validateBody(sendMessageSchema), asyncHandler(supportController.sendMessage));
supportRouter.get("/unread", asyncHandler(supportController.getUnreadCount));
