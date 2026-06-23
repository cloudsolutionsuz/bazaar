import type { Request, Response } from "express";
import * as storefrontService from "./storefront.service";
import * as ordersService from "../orders/orders.service";
import type { ListStorefrontProductsQuery } from "./storefront.schema";
import type { CreateOrderInput } from "../orders/orders.schema";

export async function listCategories(req: Request, res: Response): Promise<void> {
  const categories = await storefrontService.listCategories(req.tenant!.id);
  res.json({ categories });
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const result = await storefrontService.listProducts(req.tenant!.id, req.query as unknown as ListStorefrontProductsQuery);
  res.json(result);
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const product = await storefrontService.getProduct(req.tenant!.id, req.params.id);
  res.json({ product });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const order = await ordersService.createOrder(req.tenant!.id, null, req.body as CreateOrderInput);
  res.status(201).json({ order });
}
