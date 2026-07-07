import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { validateBody } from "../../middleware/validate";
import { acceptInviteSchema, forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "./auth.schema";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
authRouter.post("/accept-invite", validateBody(acceptInviteSchema), asyncHandler(authController.acceptInvite));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", validateBody(refreshSchema), asyncHandler(authController.refresh));
authRouter.post("/logout", validateBody(refreshSchema), asyncHandler(authController.logout));
authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post("/reset-password", validateBody(resetPasswordSchema), asyncHandler(authController.resetPassword));
authRouter.get("/me", requireAuth({ allowBlocked: true }), asyncHandler(authController.me));
