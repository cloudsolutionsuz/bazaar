import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { sendStaffMessageSchema } from "./chat.schema";
import * as chatController from "./chat.controller";

export const chatRouter = Router();

chatRouter.use(requireAuth(), requireRole("OWNER", "MANAGER", "CASHIER"));

chatRouter.get("/threads", asyncHandler(chatController.listThreads));
chatRouter.get("/threads/:customerId/messages", asyncHandler(chatController.getThreadMessages));
chatRouter.post(
  "/threads/:customerId/messages",
  validateBody(sendStaffMessageSchema),
  asyncHandler(chatController.sendStaffMessage),
);
chatRouter.get("/unread-count", asyncHandler(chatController.getUnreadCount));
chatRouter.get("/push/vapid-key", asyncHandler(chatController.getPushVapidKey));
chatRouter.post("/push/subscribe", asyncHandler(chatController.subscribePush));
