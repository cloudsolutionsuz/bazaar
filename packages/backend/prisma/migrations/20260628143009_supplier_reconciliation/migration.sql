-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'SUPPLIER_RETURN';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "supplierId" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
