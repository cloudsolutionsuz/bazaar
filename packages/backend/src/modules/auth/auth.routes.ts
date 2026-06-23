import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { validateBody } from "../../middleware/validate";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
authRouter.get("/verify-email", asyncHandler(authController.verifyEmail));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", validateBody(refreshSchema), asyncHandler(authController.refresh));
authRouter.post("/logout", validateBody(refreshSchema), asyncHandler(authController.logout));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
