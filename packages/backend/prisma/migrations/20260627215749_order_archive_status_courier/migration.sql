-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courierName" TEXT;
