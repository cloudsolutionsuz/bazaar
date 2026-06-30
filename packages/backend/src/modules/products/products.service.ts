import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { assertWithinPlanLimit } from "../plans/limits";
import { deleteStoredImage } from "../../utils/imageStorage";
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  UpdateProductInput,
  UpdateVariantInput,
} from "./products.schema";

const MAX_IMAGES_PER_PRODUCT = 3;

const productInclude = {
  variants: { include: { supplier: true } },
  images: { orderBy: { position: "asc" as const } },
  category: true,
};

async function assertSkuAvailable(tenantId: string, sku: string, excludeVariantId?: string): Promise<void> {
  const existing = await prisma.productVariant.findUnique({ where: { tenantId_sku: { tenantId, sku } } });
  if (existing && existing.id !== excludeVariantId) {
    throw new AppError(409, "SKU_TAKEN", `SKU "${sku}" is already in use`);
  }
}

async function assertCategoryOwned(tenantId: string, categoryId: string): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!category) {
    throw new AppError(400, "INVALID_CATEGORY", "Category not found");
  }
}

export async function getProduct(tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: productInclude,
  });
  if (!product) {
    throw new AppError(404, "NOT_FOUND", "Product not found");
  }
  return product;
}

export async function listProducts(tenantId: string, query: ListProductsQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.ProductWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { variants: { some: { sku: { contains: query.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createProduct(tenantId: string, userId: string, input: CreateProductInput) {
  await assertWithinPlanLimit(tenantId, "products");

  if (input.categoryId) {
    await assertCategoryOwned(tenantId, input.categoryId);
  }

  const variantsInput = input.variants ?? [];
  const skus = variantsInput.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    throw new AppError(400, "DUPLICATE_SKU", "Duplicate SKU in request");
  }
  for (const sku of skus) {
    await assertSkuAvailable(tenantId, sku);
  }
  const supplierIds = [...new Set(variantsInput.map((v) => v.supplierId).filter((id): id is string => !!id))];
  if (supplierIds.length > 0) {
    const count = await prisma.supplier.count({ where: { id: { in: supplierIds }, tenantId } });
    if (count !== supplierIds.length) {
      throw new AppError(400, "INVALID_SUPPLIER", "Supplier not found");
    }
  }

  const productId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        descriptionRu: input.descriptionRu,
        descriptionUz: input.descriptionUz,
        price: input.price,
        discountPercent: input.discountPercent,
        brand: input.brand,
        color: input.color,
        code: input.code,
        currency: input.currency ?? "UZS",
        categoryId: input.categoryId,
        status: input.status ?? "ACTIVE",
      },
    });

    const variantsToCreate = variantsInput.length > 0 ? variantsInput : [{ sku: `SKU-${product.id.slice(0, 8).toUpperCase()}` }];

    for (const v of variantsToCreate) {
      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          name: v.name,
          sku: v.sku,
          priceOverride: v.priceOverride,
          costPrice: v.costPrice,
          stockQuantity: v.stockQuantity ?? 0,
          lowStockThreshold: v.lowStockThreshold,
          supplierId: v.supplierId,
        },
      });

      if (v.stockQuantity && v.stockQuantity > 0) {
        // A supplier+cost on the initial stock is a real purchase, not a
        // shapeless adjustment - book it as a RECEIPT so it feeds supplier
        // debt (computeSupplierBalances) and FIFO COGS like any other receipt.
        if (v.supplierId && v.costPrice) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantId: variant.id,
              type: "RECEIPT",
              quantity: v.stockQuantity,
              purchasePrice: v.costPrice,
              supplierId: v.supplierId,
              note: "Initial stock at creation",
              createdByUserId: userId,
            },
          });
        } else {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              variantId: variant.id,
              type: "ADJUSTMENT",
              quantity: v.stockQuantity,
              note: "Initial stock at creation",
              createdByUserId: userId,
            },
          });
        }
      }
    }

    return product.id;
  });

  return getProduct(tenantId, productId);
}

export async function updateProduct(tenantId: string, productId: string, input: UpdateProductInput) {
  await getProduct(tenantId, productId);

  if (input.categoryId) {
    await assertCategoryOwned(tenantId, input.categoryId);
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.descriptionRu !== undefined ? { descriptionRu: input.descriptionRu } : {}),
      ...(input.descriptionUz !== undefined ? { descriptionUz: input.descriptionUz } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  return getProduct(tenantId, productId);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const product = await getProduct(tenantId, productId);

  const orderItemCount = await prisma.orderItem.count({ where: { variant: { productId: product.id } } });
  if (orderItemCount > 0) {
    throw new AppError(409, "PRODUCT_HAS_ORDERS", "Cannot delete a product referenced by existing orders; hide it instead");
  }

  for (const image of product.images) {
    await deleteStoredImage(image.url);
  }

  await prisma.product.delete({ where: { id: productId } });
}

async function getOwnedVariant(tenantId: string, productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId, tenantId } });
  if (!variant) {
    throw new AppError(404, "NOT_FOUND", "Variant not found");
  }
  return variant;
}

export async function createVariant(tenantId: string, userId: string, productId: string, input: CreateVariantInput) {
  await getProduct(tenantId, productId);
  await assertSkuAvailable(tenantId, input.sku);

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
    if (!supplier) {
      throw new AppError(400, "INVALID_SUPPLIER", "Supplier not found");
    }
  }

  const variant = await prisma.productVariant.create({
    data: {
      tenantId,
      productId,
      name: input.name,
      sku: input.sku,
      priceOverride: input.priceOverride,
      costPrice: input.costPrice,
      stockQuantity: input.stockQuantity ?? 0,
      lowStockThreshold: input.lowStockThreshold,
      supplierId: input.supplierId,
    },
  });

  if (input.stockQuantity && input.stockQuantity > 0) {
    // Same receipt-vs-adjustment split as createProduct's initial-variant path:
    // a supplier+cost turns the opening stock into a real purchase that owes
    // the supplier money, not a shapeless count adjustment.
    if (input.supplierId && input.costPrice) {
      await prisma.inventoryMovement.create({
        data: {
          tenantId,
          variantId: variant.id,
          type: "RECEIPT",
          quantity: input.stockQuantity,
          purchasePrice: input.costPrice,
          supplierId: input.supplierId,
          note: "Initial stock at creation",
          createdByUserId: userId,
        },
      });
    } else {
      await prisma.inventoryMovement.create({
        data: {
          tenantId,
          variantId: variant.id,
          type: "ADJUSTMENT",
          quantity: input.stockQuantity,
          note: "Initial stock at creation",
          createdByUserId: userId,
        },
      });
    }
  }

  return variant;
}

export async function updateVariant(tenantId: string, productId: string, variantId: string, input: UpdateVariantInput) {
  await getOwnedVariant(tenantId, productId, variantId);

  if (input.sku) {
    await assertSkuAvailable(tenantId, input.sku, variantId);
  }

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
    if (!supplier) {
      throw new AppError(400, "INVALID_SUPPLIER", "Supplier not found");
    }
  }

  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.priceOverride !== undefined ? { priceOverride: input.priceOverride } : {}),
      ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
      ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
    },
  });
}

export async function deleteVariant(tenantId: string, productId: string, variantId: string): Promise<void> {
  await getOwnedVariant(tenantId, productId, variantId);

  const orderItemCount = await prisma.orderItem.count({ where: { variantId } });
  if (orderItemCount > 0) {
    throw new AppError(409, "VARIANT_HAS_ORDERS", "Cannot delete a variant referenced by existing orders");
  }

  const remaining = await prisma.productVariant.count({ where: { productId } });
  if (remaining <= 1) {
    throw new AppError(409, "LAST_VARIANT", "A product must have at least one variant");
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
}

export async function addImages(tenantId: string, productId: string, urls: string[]) {
  const product = await getProduct(tenantId, productId);

  if (product.images.length + urls.length > MAX_IMAGES_PER_PRODUCT) {
    throw new AppError(400, "TOO_MANY_IMAGES", `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
  }

  await prisma.productImage.createMany({
    data: urls.map((url, i) => ({ productId, url, position: product.images.length + i })),
  });

  return getProduct(tenantId, productId);
}

export async function deleteImage(tenantId: string, productId: string, imageId: string): Promise<void> {
  await getProduct(tenantId, productId);

  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) {
    throw new AppError(404, "NOT_FOUND", "Image not found");
  }

  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteStoredImage(image.url);
}

export async function reorderImages(tenantId: string, productId: string, imageIds: string[]): Promise<void> {
  const product = await getProduct(tenantId, productId);
  const existingIds = new Set(product.images.map((i) => i.id));

  if (imageIds.length !== existingIds.size || !imageIds.every((id) => existingIds.has(id))) {
    throw new AppError(400, "INVALID_IMAGE_SET", "imageIds must match the product's existing images exactly");
  }

  await prisma.$transaction(imageIds.map((id, position) => prisma.productImage.update({ where: { id }, data: { position } })));
}

const EXPORT_HEADERS = [
  "Name",
  "Category",
  "Description",
  "Price",
  "DiscountPercent",
  "Currency",
  "Brand",
  "Color",
  "Code",
  "SKU",
  "Variant",
  "PriceOverride",
  "CostPrice",
  "Supplier",
  "Stock",
  "LowStockThreshold",
  "Status",
];

export async function exportProductsToExcel(tenantId: string): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { variants: { include: { supplier: true } }, category: true },
    orderBy: { createdAt: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.addRow(EXPORT_HEADERS);

  for (const product of products) {
    for (const variant of product.variants) {
      sheet.addRow([
        product.name,
        product.category?.name ?? "",
        product.description ?? "",
        product.price,
        product.discountPercent ?? "",
        product.currency,
        product.brand ?? "",
        product.color ?? "",
        product.code ?? "",
        variant.sku,
        variant.name ?? "",
        variant.priceOverride ?? "",
        variant.costPrice ?? "",
        variant.supplier?.name ?? "",
        variant.stockQuantity,
        variant.lowStockThreshold ?? "",
        product.status,
      ]);
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// A separate, lighter download from exportProductsToExcel: not the tenant's
// actual data, just the column headers plus one filled-in example row and a
// "notes" sheet explaining each column - "give me a template" is a distinct
// ask from "export what I have", and a real tenant could have zero products
// to export from yet.
export async function exportProductImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.addRow(EXPORT_HEADERS);
  sheet.addRow([
    "Футболка хлопковая",
    "Одежда",
    "Описание товара",
    150000,
    10,
    "UZS",
    "Nike",
    "Белый",
    "ABC-001",
    "SKU-0001",
    "M, белый",
    "",
    100000,
    "Поставщик ООО",
    20,
    5,
    "ACTIVE",
  ]);

  const notes = workbook.addWorksheet("Notes");
  notes.addRow(["Column", "Required", "Description"]);
  notes.addRow(["Name", "yes", "Product name"]);
  notes.addRow(["Category", "no", "Must match an existing category name exactly, otherwise left empty"]);
  notes.addRow(["Description", "no", "Generic description"]);
  notes.addRow(["Price", "yes", "Whole number, e.g. 150000"]);
  notes.addRow(["DiscountPercent", "no", "1-99, percent off Price shown to customers"]);
  notes.addRow(["Currency", "no", "Defaults to UZS"]);
  notes.addRow(["Brand", "no", ""]);
  notes.addRow(["Color", "no", ""]);
  notes.addRow(["Code", "no", "Internal product code"]);
  notes.addRow(["SKU", "yes", "Must be unique across the shop"]);
  notes.addRow(["Variant", "no", "Variant name, e.g. size/color"]);
  notes.addRow(["PriceOverride", "no", "Per-variant price, overrides Price if set"]);
  notes.addRow(["CostPrice", "no", "Purchase price - combined with Supplier, books an inventory receipt and a supplier debt"]);
  notes.addRow(["Supplier", "no", "Must match an existing supplier name exactly, otherwise ignored"]);
  notes.addRow(["Stock", "no", "Opening stock quantity, defaults to 0"]);
  notes.addRow(["LowStockThreshold", "no", "Triggers a low-stock notification once stock falls at or below this"]);
  notes.addRow(["Status", "no", "ACTIVE, HIDDEN, or OUT_OF_STOCK - defaults to ACTIVE"]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

interface ImportRowError {
  row: number;
  message: string;
}

interface ImportResult {
  created: number;
  errors: ImportRowError[];
}

export async function importProductsFromExcel(tenantId: string, userId: string, buffer: Buffer): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types lag behind current @types/node Buffer generics.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AppError(400, "INVALID_FILE", "No worksheet found in the uploaded file");
  }

  const headers = (sheet.getRow(1).values as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const colIndex = (label: string) => headers.indexOf(label.toLowerCase());

  const nameIdx = colIndex("name");
  const skuIdx = colIndex("sku");
  const priceIdx = colIndex("price");
  const descriptionIdx = colIndex("description");
  const stockIdx = colIndex("stock");
  const categoryIdx = colIndex("category");
  const brandIdx = colIndex("brand");
  const colorIdx = colIndex("color");
  const codeIdx = colIndex("code");
  const currencyIdx = colIndex("currency");
  const discountIdx = colIndex("discountpercent");
  const costPriceIdx = colIndex("costprice");
  const supplierIdx = colIndex("supplier");

  if (nameIdx === -1 || skuIdx === -1 || priceIdx === -1) {
    throw new AppError(400, "INVALID_FILE", "File must have Name, SKU and Price columns");
  }

  const categories = await prisma.category.findMany({ where: { tenantId } });
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const suppliers = await prisma.supplier.findMany({ where: { tenantId } });
  const supplierByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

  const result: ImportResult = { created: 0, errors: [] };

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = row.values as unknown[];
    if (!values || values.length === 0) continue;

    const name = String(values[nameIdx] ?? "").trim();
    const sku = String(values[skuIdx] ?? "").trim();
    const priceRaw = values[priceIdx];
    const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);

    if (!name || !sku || !Number.isFinite(price) || price <= 0) {
      result.errors.push({ row: rowNumber, message: "Missing or invalid name/sku/price" });
      continue;
    }

    try {
      await assertWithinPlanLimit(tenantId, "products");
    } catch {
      result.errors.push({ row: rowNumber, message: "Plan limit reached, stopping import" });
      break;
    }

    try {
      await assertSkuAvailable(tenantId, sku);
    } catch {
      result.errors.push({ row: rowNumber, message: `SKU "${sku}" already exists` });
      continue;
    }

    const description = descriptionIdx >= 0 ? String(values[descriptionIdx] ?? "").trim() || undefined : undefined;
    const stockQuantity = stockIdx >= 0 ? Number(values[stockIdx]) || 0 : 0;
    const categoryName = categoryIdx >= 0 ? String(values[categoryIdx] ?? "").trim().toLowerCase() : "";
    const categoryId = categoryName ? categoryByName.get(categoryName) : undefined;
    const brand = brandIdx >= 0 ? String(values[brandIdx] ?? "").trim() || undefined : undefined;
    const color = colorIdx >= 0 ? String(values[colorIdx] ?? "").trim() || undefined : undefined;
    const code = codeIdx >= 0 ? String(values[codeIdx] ?? "").trim() || undefined : undefined;
    const currency = currencyIdx >= 0 ? String(values[currencyIdx] ?? "").trim() || undefined : undefined;
    const discountRaw = discountIdx >= 0 ? Number(values[discountIdx]) : NaN;
    const discountPercent = Number.isFinite(discountRaw) && discountRaw > 0 ? discountRaw : undefined;
    const costPriceRaw = costPriceIdx >= 0 ? Number(values[costPriceIdx]) : NaN;
    const costPrice = Number.isFinite(costPriceRaw) && costPriceRaw > 0 ? costPriceRaw : undefined;
    const supplierName = supplierIdx >= 0 ? String(values[supplierIdx] ?? "").trim().toLowerCase() : "";
    const supplierId = supplierName ? supplierByName.get(supplierName) : undefined;

    await createProduct(tenantId, userId, {
      name,
      description,
      price,
      discountPercent,
      brand,
      color,
      code,
      currency,
      categoryId,
      variants: [{ sku, stockQuantity, costPrice, supplierId }],
    });
    result.created += 1;
  }

  return result;
}
