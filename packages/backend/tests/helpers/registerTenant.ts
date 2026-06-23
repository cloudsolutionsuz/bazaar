import type { Express } from "express";
import request from "supertest";
import { prisma } from "../../src/db/prisma";

export interface TestSeller {
  accessToken: string;
  tenantId: string;
  userId: string;
  subdomain: string;
  email: string;
}

export async function registerAndLoginSeller(app: Express, planCode: "start" | "business" | "pro" = "business"): Promise<TestSeller> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `tester${suffix}@example.com`;
  const password = "supersecret123";
  const subdomain = `testshop${suffix}`;

  await request(app).post("/api/auth/register").send({
    name: "Test Seller",
    email,
    password,
    shopName: "Test Shop",
    subdomain,
    planCode,
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const verification = await prisma.verificationToken.findFirstOrThrow({ where: { userId: user.id } });
  await request(app).get(`/api/auth/verify-email?token=${verification.token}`);

  const login = await request(app).post("/api/auth/login").send({ email, password });

  return {
    accessToken: login.body.accessToken,
    tenantId: login.body.tenant.id,
    userId: user.id,
    subdomain,
    email,
  };
}
