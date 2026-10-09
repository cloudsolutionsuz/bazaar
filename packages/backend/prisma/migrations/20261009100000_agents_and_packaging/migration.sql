-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGENT';

-- CreateEnum
CREATE TYPE "SaleUnit" AS ENUM ('PIECE', 'BLOCK', 'BOX');

-- CreateEnum
CREATE TYPE "AgentBonusType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "piecesPerBlock" INTEGER,
ADD COLUMN "piecesPerBox" INTEGER;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "unit" "SaleUnit" NOT NULL DEFAULT 'PIECE',
ADD COLUMN "unitSize" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "agentId" TEXT,
ADD COLUMN "agentBonus" INTEGER,
ADD COLUMN "agentBonusAccruedAt" TIMESTAMP(3),
ADD COLUMN "agentPayoutId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "agentId" TEXT;

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegram" TEXT,
    "instagram" TEXT,
    "youtube" TEXT,
    "tiktok" TEXT,
    "refCode" TEXT NOT NULL,
    "bonusType" "AgentBonusType" NOT NULL DEFAULT 'PERCENT',
    "bonusValue" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_payouts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_userId_key" ON "agents"("userId");
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");
CREATE UNIQUE INDEX "agents_tenantId_refCode_key" ON "agents"("tenantId", "refCode");
CREATE UNIQUE INDEX "agent_payouts_transactionId_key" ON "agent_payouts"("transactionId");
CREATE INDEX "agent_payouts_tenantId_idx" ON "agent_payouts"("tenantId");
CREATE INDEX "agent_payouts_agentId_idx" ON "agent_payouts"("agentId");
CREATE INDEX "orders_agentId_idx" ON "orders"("agentId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_agentPayoutId_fkey" FOREIGN KEY ("agentPayoutId") REFERENCES "agent_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_payouts" ADD CONSTRAINT "agent_payouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_payouts" ADD CONSTRAINT "agent_payouts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_payouts" ADD CONSTRAINT "agent_payouts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
