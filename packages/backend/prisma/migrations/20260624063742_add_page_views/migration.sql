-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_views_tenantId_idx" ON "page_views"("tenantId");

-- CreateIndex
CREATE INDEX "page_views_tenantId_createdAt_idx" ON "page_views"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
