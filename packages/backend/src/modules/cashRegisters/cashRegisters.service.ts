import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { CreateCashRegisterInput, UpdateCashRegisterInput } from "./cashRegisters.schema";

export function listCashRegisters(tenantId: string) {
  return prisma.cashRegister.findMany({ where: { tenantId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
}

export function createCashRegister(tenantId: string, input: CreateCashRegisterInput) {
  return prisma.cashRegister.create({ data: { tenantId, name: input.name, isDefault: false, isActive: true } });
}

async function getCashRegisterOrThrow(tenantId: string, cashRegisterId: string) {
  const register = await prisma.cashRegister.findFirst({ where: { id: cashRegisterId, tenantId } });
  if (!register) {
    throw new AppError(404, "NOT_FOUND", "Cash register not found");
  }
  return register;
}

export async function updateCashRegister(tenantId: string, cashRegisterId: string, input: UpdateCashRegisterInput) {
  const register = await getCashRegisterOrThrow(tenantId, cashRegisterId);

  const willBeActive = input.isActive ?? register.isActive;
  if (input.isDefault === true && !willBeActive) {
    throw new AppError(400, "INACTIVE_CANNOT_BE_DEFAULT", "An inactive register cannot be the default");
  }
  if (input.isActive === false && register.isDefault && input.isDefault !== true) {
    throw new AppError(400, "CANNOT_DEACTIVATE_DEFAULT", "Promote a different register to default before deactivating this one");
  }

  if (input.isDefault === true) {
    return prisma.$transaction(async (tx) => {
      await tx.cashRegister.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      return tx.cashRegister.update({ where: { id: cashRegisterId }, data: { ...input, isDefault: true } });
    });
  }

  return prisma.cashRegister.update({ where: { id: cashRegisterId }, data: input });
}
