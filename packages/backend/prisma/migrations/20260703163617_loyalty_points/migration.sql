-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyMinRedeem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRate" INTEGER NOT NULL DEFAULT 1;
