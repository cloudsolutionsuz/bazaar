import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

function extractSubdomain(hostname: string): string | null {
  const base = env.baseDomain;
  if (hostname === base || hostname === `www.${base}`) {
    return null;
  }
  if (!hostname.endsWith(`.${base}`)) {
    return null;
  }
  const subdomain = hostname.slice(0, hostname.length - base.length - 1);
  if (!subdomain || subdomain.includes(".")) {
    return null;
  }
  return subdomain;
}

/**
 * Resolves the tenant for the current request from the Host header subdomain
 * (e.g. megamart.bazaar.uz -> tenant with subdomain "megamart").
 * Advisory only at this stage: sets req.tenant if a match is found, otherwise
 * leaves it null. Does not block the request - routes that need a tenant to
 * be present should check req.tenant themselves.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const subdomain = extractSubdomain(req.hostname);

    if (!subdomain || subdomain === "superadmin") {
      req.tenant = null;
      next();
      return;
    }

    req.tenant = await prisma.tenant.findUnique({ where: { subdomain } });
    next();
  } catch (err) {
    next(err);
  }
}

export { extractSubdomain };
