import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../utils/password";
import { assertWithinPlanLimit } from "../plans/limits";
import { toPublicUser } from "../auth/auth.service";
import type { InviteEmployeeInput, UpdateEmployeeInput } from "./employees.schema";

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

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  return toPublicUser(user);
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
