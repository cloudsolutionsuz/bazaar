CREATE TABLE "admin_push_subscriptions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_push_subscriptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_push_subscriptions"
  ADD CONSTRAINT "admin_push_subscriptions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_push_subscriptions"
  ADD CONSTRAINT "admin_push_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "admin_push_subscriptions_endpoint_key" ON "admin_push_subscriptions"("endpoint");
CREATE INDEX "admin_push_subscriptions_tenantId_idx" ON "admin_push_subscriptions"("tenantId");
