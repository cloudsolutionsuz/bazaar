import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

// For public storefront routes: req.tenant is set advisorily by the global
// resolveTenant middleware (based on the Host header's subdomain). These
// guards turn that into hard 404/403s for routes that require a real,
// operating shop - unlike admin routes, which resolve tenant from the JWT.
export function requireResolvedTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant) {
    next(new AppError(404, "SHOP_NOT_FOUND", "Shop not found"));
    return;
  }
  next();
}

export function requireActiveTenant(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenant?.status === "BLOCKED") {
    next(new AppError(403, "SHOP_BLOCKED", "This shop is currently unavailable"));
    return;
  }
  next();
}
