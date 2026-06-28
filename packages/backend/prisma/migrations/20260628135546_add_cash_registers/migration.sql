-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "cashRegisterId" TEXT;

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_registers_tenantId_idx" ON "cash_registers"("tenantId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: give every existing tenant a default register, and assign
-- every already-CONFIRMED transaction to it. PENDING transactions are left
-- with cashRegisterId = null on purpose - they get assigned a register the
-- normal way, at confirmation time.
INSERT INTO "cash_registers" ("id", "tenantId", "name", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'Основная касса', true, true, now(), now() FROM "tenants";

UPDATE "transactions" t
SET "cashRegisterId" = cr."id"
FROM "cash_registers" cr
WHERE cr."tenantId" = t."tenantId" AND cr."isDefault" = true AND t."status" = 'CONFIRMED';
