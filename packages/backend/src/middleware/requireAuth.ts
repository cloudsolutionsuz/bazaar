import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./errorHandler";

/**
 * Authenticates the request via JWT and re-loads the user+tenant fresh from
 * the DB on every request (not just from token claims) so that a tenant
 * blocked for non-payment is rejected immediately, without waiting for the
 * access token to expire. Tenant context here comes from the user record,
 * not the request Host header - sellers can log in from a shared
 * admin.bazaar.uz domain regardless of their shop's subdomain.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHENTICATED", "Missing bearer token");
    }
    const token = header.slice("Bearer ".length);

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "INVALID_TOKEN", "Access token is invalid or expired");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError(401, "INVALID_TOKEN", "User no longer exists");
    }

    if (user.tenant && user.tenant.status === "BLOCKED") {
      throw new AppError(403, "TENANT_BLOCKED", "Shop is blocked, please contact support");
    }

    req.authUser = { id: user.id, role: user.role, tenantId: user.tenantId };
    req.tenant = user.tenant ?? null;
    next();
  } catch (err) {
    next(err);
  }
}
