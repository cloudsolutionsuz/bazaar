import type { Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { saveCompressedImage } from "../../utils/imageStorage";
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  UpdateProductInput,
  UpdateVariantInput,
} from "./products.schema";
import * as productsService from "./products.service";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await productsService.listProducts(req.authUser!.tenantId!, req.query as unknown as ListProductsQuery);
  res.json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const product = await productsService.createProduct(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateProductInput);
  res.status(201).json({ product });
}

export async function get(req: Request, res: Response): Promise<void> {
  const product = await productsService.getProduct(req.authUser!.tenantId!, req.params.id);
  res.json({ product });
}

export async function update(req: Request, res: Response): Promise<void> {
  const product = await productsService.updateProduct(req.authUser!.tenantId!, req.params.id, req.body as UpdateProductInput);
  res.json({ product });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await productsService.deleteProduct(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}

export async function createVariant(req: Request, res: Response): Promise<void> {
  const variant = await productsService.createVariant(
    req.authUser!.tenantId!,
    req.authUser!.id,
    req.params.productId,
    req.body as CreateVariantInput,
  );
  res.status(201).json({ variant });
}

export async function updateVariant(req: Request, res: Response): Promise<void> {
  const variant = await productsService.updateVariant(
    req.authUser!.tenantId!,
    req.params.productId,
    req.params.variantId,
    req.body as UpdateVariantInput,
  );
  res.json({ variant });
}

export async function deleteVariant(req: Request, res: Response): Promise<void> {
  await productsService.deleteVariant(req.authUser!.tenantId!, req.params.productId, req.params.variantId);
  res.status(204).send();
}

export async function uploadImages(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new AppError(400, "NO_FILES", "No image files were uploaded");
  }

  const urls = await Promise.all(files.map((file) => saveCompressedImage(file.buffer)));
  const product = await productsService.addImages(req.authUser!.tenantId!, req.params.id, urls);
  res.status(201).json({ product });
}

export async function deleteImage(req: Request, res: Response): Promise<void> {
  await productsService.deleteImage(req.authUser!.tenantId!, req.params.id, req.params.imageId);
  res.status(204).send();
}

export async function reorderImages(req: Request, res: Response): Promise<void> {
  await productsService.reorderImages(req.authUser!.tenantId!, req.params.id, req.body.imageIds as string[]);
  res.status(204).send();
}

export async function exportProducts(req: Request, res: Response): Promise<void> {
  const buffer = await productsService.exportProductsToExcel(req.authUser!.tenantId!);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
  res.send(buffer);
}

export async function importProducts(req: Request, res: Response): Promise<void> {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError(400, "NO_FILE", "No file was uploaded");
  }

  const result = await productsService.importProductsFromExcel(req.authUser!.tenantId!, req.authUser!.id, file.buffer);
  res.json(result);
}
