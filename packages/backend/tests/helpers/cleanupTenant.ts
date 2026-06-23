import { prisma } from "../../src/db/prisma";

// tenantId columns on the new product/order tables are Restrict (not
// Cascade) on purpose - production tenants get BLOCKED, never hard-deleted.
// Tests that create throwaway tenants must unwind the dependency graph
// themselves in this order.
export async function deleteTenantCompletely(tenantId: string): Promise<void> {
  const orderIds = (await prisma.order.findMany({ where: { tenantId }, select: { id: true } })).map((o) => o.id);
  const productIds = (await prisma.product.findMany({ where: { tenantId }, select: { id: true } })).map((p) => p.id);
  const userIds = (await prisma.user.findMany({ where: { tenantId }, select: { id: true } })).map((u) => u.id);

  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { tenantId } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productVariant.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.verificationToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.billingInvoice.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}
