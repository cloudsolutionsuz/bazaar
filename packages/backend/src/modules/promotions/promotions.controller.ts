import type { Request, Response } from "express";
import * as promotionsService from "./promotions.service";
import type {
  BulkDiscountInput,
  CreatePromotionInput,
  ListPromotionsQuery,
  ProductSelectorInput,
  UpdatePromotionInput,
} from "./promotions.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await promotionsService.listPromotions(req.authUser!.tenantId!, req.query as unknown as ListPromotionsQuery);
  res.json(result);
}

export async function get(req: Request, res: Response): Promise<void> {
  const promotion = await promotionsService.getPromotion(req.authUser!.tenantId!, req.params.id);
  res.json({ promotion });
}

export async function create(req: Request, res: Response): Promise<void> {
  const promotion = await promotionsService.createPromotion(req.authUser!.tenantId!, req.body as CreatePromotionInput);
  res.status(201).json({ promotion });
}

export async function update(req: Request, res: Response): Promise<void> {
  const promotion = await promotionsService.updatePromotion(req.authUser!.tenantId!, req.params.id, req.body as UpdatePromotionInput);
  res.json({ promotion });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await promotionsService.deletePromotion(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}

export async function attachProducts(req: Request, res: Response): Promise<void> {
  const promotion = await promotionsService.attachProducts(req.authUser!.tenantId!, req.params.id, req.body as ProductSelectorInput);
  res.json({ promotion });
}

export async function detachProduct(req: Request, res: Response): Promise<void> {
  await promotionsService.detachProduct(req.authUser!.tenantId!, req.params.id, req.params.productId);
  res.status(204).send();
}

export async function bulkDiscount(req: Request, res: Response): Promise<void> {
  const result = await promotionsService.applyBulkDiscount(req.authUser!.tenantId!, req.body as BulkDiscountInput);
  res.json(result);
}
