import crypto from "node:crypto";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../utils/password";
import { sendEmployeeInviteEmail } from "../../utils/email";
import { assertWithinPlanLimit } from "../plans/limits";
import { toPublicUser } from "../auth/auth.service";
import type { InviteEmployeeInput, UpdateEmployeeInput } from "./employees.schema";

const INVITE_TTL_HOURS = 72;

export async function listEmployees(tenantId: string) {
  const users = await prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  return users.map(toPublicUser);
}

export async function inviteEmployee(tenantId: string, input: InviteEmployeeInput) {
  await assertWithinPlanLimit(tenantId, "employees");

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  // Unusable until accept-invite sets a real password - emailVerifiedAt
  // stays null until then, which the existing login() check already
  // treats as "please verify your email" (here: accept the invite first).
  const unusablePasswordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: unusablePasswordHash,
      },
    });

    const token = crypto.randomBytes(32).toString("hex");
    await tx.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "EMPLOYEE_INVITE",
        expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    return { user, token };
  });

  await sendEmployeeInviteEmail(result.user.email, result.token);

  return toPublicUser(result.user);
}

async function getModifiableEmployee(tenantId: string, employeeId: string) {
  const employee = await prisma.user.findFirst({ where: { id: employeeId, tenantId } });
  if (!employee) {
    throw new AppError(404, "NOT_FOUND", "Employee not found");
  }
  if (employee.role === "OWNER") {
    throw new AppError(403, "CANNOT_MODIFY_OWNER", "Cannot modify the shop owner");
  }
  return employee;
}

export async function updateEmployeeRole(tenantId: string, employeeId: string, input: UpdateEmployeeInput) {
  await getModifiableEmployee(tenantId, employeeId);
  const updated = await prisma.user.update({ where: { id: employeeId }, data: { role: input.role } });
  return toPublicUser(updated);
}

export async function removeEmployee(tenantId: string, employeeId: string, requestingUserId: string): Promise<void> {
  if (employeeId === requestingUserId) {
    throw new AppError(400, "CANNOT_REMOVE_SELF", "You cannot remove yourself");
  }
  await getModifiableEmployee(tenantId, employeeId);
  // VerificationToken/RefreshToken cascade-delete with the user.
  await prisma.user.delete({ where: { id: employeeId } });
}
