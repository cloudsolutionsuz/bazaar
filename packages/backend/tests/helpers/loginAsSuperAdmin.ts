import type { Express } from "express";
import request from "supertest";
import { env } from "../../src/config/env";

export async function loginAsSuperAdmin(app: Express): Promise<string> {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: env.superadminEmail, password: env.superadminPassword });
  if (login.status !== 200) {
    throw new Error(
      `Super admin login failed (status ${login.status}) - has "npm run prisma:seed" been run against this DB?`,
    );
  }
  return login.body.accessToken;
}
