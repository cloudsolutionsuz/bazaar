CREATE TABLE "promotion_bxgy" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "buyVariantId" TEXT NOT NULL,
  "buyQty" INTEGER NOT NULL DEFAULT 1,
  "getVariantId" TEXT NOT NULL,
  "getQty" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_bxgy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotion_bxgy_promotionId_idx" ON "promotion_bxgy"("promotionId");
CREATE INDEX "promotion_bxgy_buyVariantId_idx" ON "promotion_bxgy"("buyVariantId");

ALTER TABLE "promotion_bxgy" ADD CONSTRAINT "promotion_bxgy_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_bxgy" ADD CONSTRAINT "promotion_bxgy_buyVariantId_fkey"
  FOREIGN KEY ("buyVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promotion_bxgy" ADD CONSTRAINT "promotion_bxgy_getVariantId_fkey"
  FOREIGN KEY ("getVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
