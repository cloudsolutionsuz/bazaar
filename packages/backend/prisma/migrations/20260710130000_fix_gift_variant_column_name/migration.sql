-- Rename snake_case column to camelCase as Prisma expects
ALTER TABLE "magic_boxes" DROP CONSTRAINT IF EXISTS "magic_boxes_gift_variant_id_fkey";
DROP INDEX IF EXISTS "magic_boxes_gift_variant_id_idx";

ALTER TABLE "magic_boxes" RENAME COLUMN "gift_variant_id" TO "giftVariantId";

ALTER TABLE "magic_boxes" ADD CONSTRAINT "magic_boxes_giftVariantId_fkey"
  FOREIGN KEY ("giftVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "magic_boxes_giftVariantId_idx" ON "magic_boxes"("giftVariantId");
