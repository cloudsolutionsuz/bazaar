import type { Tenant, UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: UserRole;
        tenantId: string | null;
        // Only set for role AGENT - the agent profile this login belongs to.
        agentId: string | null;
      };
      tenant?: Tenant | null;
    }
  }
}

export {};
