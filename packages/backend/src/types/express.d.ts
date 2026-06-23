import type { Tenant, UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: UserRole;
        tenantId: string | null;
      };
      tenant?: Tenant | null;
    }
  }
}

export {};
