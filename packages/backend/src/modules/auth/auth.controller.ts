import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { LoginInput, RefreshInput, RegisterInput } from "./auth.schema";
import * as authService from "./auth.service";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.registerSeller(req.body as RegisterInput);
  res.status(201).json(result);
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    throw new AppError(400, "MISSING_TOKEN", "Verification token is required");
  }
  await authService.verifyEmail(token);
  res.json({ verified: true });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  res.json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;
  const result = await authService.refreshSession(refreshToken);
  res.json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.id },
    include: { tenant: true },
  });
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }
  res.json({ user: authService.toPublicUser(user), tenant: user.tenant });
}
