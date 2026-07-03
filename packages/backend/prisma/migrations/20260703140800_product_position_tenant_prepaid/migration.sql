-- AlterTable
ALTER TABLE "products" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "prepaidUntil" TIMESTAMP(3);
