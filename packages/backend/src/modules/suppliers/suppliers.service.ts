import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import type { CreateSupplierInput, ListSuppliersQuery, UpdateSupplierInput } from "./suppliers.schema";

export async function listSuppliers(tenantId: string, query: ListSuppliersQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.SupplierWhereInput = {
    tenantId,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.supplier.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export function createSupplier(tenantId: string, input: CreateSupplierInput) {
  return prisma.supplier.create({ data: { tenantId, ...input } });
}

async function getSupplierOrThrow(tenantId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) {
    throw new AppError(404, "NOT_FOUND", "Supplier not found");
  }
  return supplier;
}

export async function updateSupplier(tenantId: string, supplierId: string, input: UpdateSupplierInput) {
  await getSupplierOrThrow(tenantId, supplierId);
  return prisma.supplier.update({ where: { id: supplierId }, data: input });
}

export async function deleteSupplier(tenantId: string, supplierId: string): Promise<void> {
  await getSupplierOrThrow(tenantId, supplierId);

  const movementCount = await prisma.inventoryMovement.count({ where: { supplierId } });
  if (movementCount > 0) {
    throw new AppError(409, "SUPPLIER_HAS_MOVEMENTS", "Cannot delete a supplier referenced by existing inventory receipts");
  }

  await prisma.supplier.delete({ where: { id: supplierId } });
}
