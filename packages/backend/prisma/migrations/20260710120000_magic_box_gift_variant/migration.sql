-- Drop order_magic_boxes table (replaced by gift OrderItem)
DROP TABLE IF EXISTS "order_magic_boxes";

-- Add gift_variant_id to magic_boxes
ALTER TABLE "magic_boxes" ADD COLUMN "gift_variant_id" TEXT;
ALTER TABLE "magic_boxes" ADD CONSTRAINT "magic_boxes_gift_variant_id_fkey"
  FOREIGN KEY ("gift_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "magic_boxes_gift_variant_id_idx" ON "magic_boxes"("gift_variant_id");
