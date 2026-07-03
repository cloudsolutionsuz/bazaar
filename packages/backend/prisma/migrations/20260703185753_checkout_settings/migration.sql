-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[];
