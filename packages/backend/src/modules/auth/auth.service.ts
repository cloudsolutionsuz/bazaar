import type { Tenant, User } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword, verifyPassword } from "../../utils/password";
import {
  generateRefreshTokenValue,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from "../../utils/jwt";
import { isValidSubdomain } from "../tenants/constants";
import type { LoginInput, RegisterInput } from "./auth.schema";

export function toPublicUser(user: User) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function registerSeller(input: RegisterInput): Promise<{ tenant: Tenant; user: ReturnType<typeof toPublicUser> }> {
  const subdomain = input.subdomain.toLowerCase();

  if (!isValidSubdomain(subdomain)) {
    throw new AppError(400, "INVALID_SUBDOMAIN", "Subdomain is invalid or reserved");
  }

  const [existingTenant, existingUser, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { subdomain } }),
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.plan.findUnique({ where: { code: input.planCode } }),
  ]);

  if (existingTenant) {
    throw new AppError(409, "SUBDOMAIN_TAKEN", "This subdomain is already taken");
  }
  if (existingUser) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }
  if (!plan) {
    throw new AppError(400, "INVALID_PLAN", "Unknown plan");
  }

  const passwordHash = await hashPassword(input.password);
  const trialEndsAt = new Date(Date.now() + env.trialDays * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.shopName,
        subdomain,
        planId: plan.id,
        status: "TRIAL",
        trialEndsAt,
      },
    });

    await tx.cashRegister.create({
      data: { tenantId: tenant.id, name: "Основная касса", isDefault: true, isActive: true },
    });

    // No email-verification step by design (matches the buyer mini-account
    // trade-off elsewhere in this project): a seller can log in immediately
    // after registering, no real SMTP needed.
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        role: "OWNER",
        name: input.name,
        phone: input.phone,
        emailVerifiedAt: new Date(),
      },
    });

    return { tenant, user };
  });

  return { tenant: result.tenant, user: toPublicUser(result.user) };
}

export async function acceptInvite(token: string, password: string): Promise<void> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.type !== "EMPLOYEE_INVITE" || record.expiresAt < new Date()) {
    throw new AppError(400, "INVALID_INVITE_TOKEN", "Invite link is invalid or expired");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: User): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, tenantId: user.tenantId });

  const refreshToken = generateRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<AuthTokens & { user: ReturnType<typeof toPublicUser>; tenant: Tenant | null }> {
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { tenant: true } });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.tenant && user.tenant.status === "BLOCKED") {
    throw new AppError(403, "TENANT_BLOCKED", "Shop is blocked, please contact support");
  }

  if (user.role !== "SUPER_ADMIN" && !user.emailVerifiedAt) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before logging in");
  }

  const tokens = await issueTokens(user);

  return { ...tokens, user: toPublicUser(user), tenant: user.tenant };
}

export async function refreshSession(refreshTokenValue: string): Promise<AuthTokens> {
  const tokenHash = hashToken(refreshTokenValue);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

  return issueTokens(record.user);
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const tokenHash = hashToken(refreshTokenValue);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
