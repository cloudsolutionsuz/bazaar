CREATE TABLE "magic_boxes" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "tenantId"    TEXT NOT NULL REFERENCES "tenants"("id"),
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "magic_boxes_tenantId_idx" ON "magic_boxes"("tenantId");

CREATE TABLE "magic_box_items" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "magicBoxId" TEXT NOT NULL REFERENCES "magic_boxes"("id") ON DELETE CASCADE,
  "variantId"  TEXT NOT NULL REFERENCES "product_variants"("id"),
  "quantity"   INTEGER NOT NULL
);
CREATE INDEX "magic_box_items_magicBoxId_idx" ON "magic_box_items"("magicBoxId");

CREATE TABLE "order_magic_boxes" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "orderId"    TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "magicBoxId" TEXT NOT NULL REFERENCES "magic_boxes"("id")
);
CREATE INDEX "order_magic_boxes_orderId_idx" ON "order_magic_boxes"("orderId");
