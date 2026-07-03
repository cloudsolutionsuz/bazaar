import type { Request, Response } from "express";
import * as storefrontService from "./storefront.service";
import * as ordersService from "../orders/orders.service";
import * as bannersService from "../banners/banners.service";
import type { ListStorefrontProductsQuery, MyOrdersQuery, PushSubscribeInput, SendChatMessageInput, TrackPageViewInput } from "./storefront.schema";
import type { CreateOrderInput } from "../orders/orders.schema";

export async function listCategories(req: Request, res: Response): Promise<void> {
  const categories = await storefrontService.listCategories(req.tenant!.id);
  res.json({ categories });
}

export async function listBrands(req: Request, res: Response): Promise<void> {
  const brands = await storefrontService.listBrands(req.tenant!.id);
  res.json({ brands });
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
  const order = await ordersService.createOrder(req.tenant!.id, null, req.body as CreateOrderInput, req.tenant!.minOrderAmount);
  res.status(201).json({ order });
}

export async function trackPageView(req: Request, res: Response): Promise<void> {
  await storefrontService.trackPageView(req.tenant!.id, req.body as TrackPageViewInput);
  res.status(204).send();
}

export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const { phone } = req.query as unknown as MyOrdersQuery;
  const orders = await storefrontService.getMyOrders(req.tenant!.id, phone);
  res.json({ orders });
}

export async function getChatMessages(req: Request, res: Response): Promise<void> {
  const { phone } = req.query as unknown as MyOrdersQuery;
  const messages = await storefrontService.getChatMessages(req.tenant!.id, phone);
  res.json({ messages });
}

export async function sendChatMessage(req: Request, res: Response): Promise<void> {
  const message = await storefrontService.sendChatMessage(req.tenant!.id, req.body as SendChatMessageInput);
  res.status(201).json({ message });
}

export async function listBanners(req: Request, res: Response): Promise<void> {
  const banners = await bannersService.listActiveBanners(req.tenant!.id);
  res.json({ banners });
}

export async function getMeta(req: Request, res: Response): Promise<void> {
  const { name, logoUrl, themeColor, description, inn, companyName, contactPhone, instagram, facebook, youtube, minOrderAmount, paymentMethods } = req.tenant!;
  res.json({ name, logoUrl, themeColor, description, inn, companyName, contactPhone, instagram, facebook, youtube, minOrderAmount, paymentMethods });
}

export async function getPushVapidKey(req: Request, res: Response): Promise<void> {
  res.json(storefrontService.getPushVapidKey());
}

export async function subscribeToPush(req: Request, res: Response): Promise<void> {
  await storefrontService.subscribeToPush(req.tenant!.id, req.body as PushSubscribeInput);
  res.status(201).json({ ok: true });
}

export async function getLoyaltyBalance(req: Request, res: Response): Promise<void> {
  const phone = String(req.query.phone ?? "").trim();
  const tenant = req.tenant!;
  if (!tenant.loyaltyEnabled) {
    res.json({ loyaltyEnabled: false, loyaltyPoints: 0, loyaltyMinRedeem: 0, loyaltyPointsRate: 1 });
    return;
  }
  const customer = await storefrontService.getCustomerByPhone(tenant.id, phone);
  res.json({
    loyaltyEnabled: true,
    loyaltyPoints: customer?.loyaltyPoints ?? 0,
    loyaltyMinRedeem: tenant.loyaltyMinRedeem,
    loyaltyPointsRate: tenant.loyaltyPointsRate,
  });
}
