CREATE TYPE "SupportMessageSender" AS ENUM ('TENANT', 'SUPER_ADMIN');

CREATE TABLE "support_messages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sender" "SupportMessageSender" NOT NULL,
  "text" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_messages_tenantId_idx" ON "support_messages"("tenantId");
CREATE INDEX "support_messages_tenantId_createdAt_idx" ON "support_messages"("tenantId", "createdAt");

ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
