import type { Request, Response } from "express";
import * as storefrontService from "./storefront.service";
import * as ordersService from "../orders/orders.service";
import * as bannersService from "../banners/banners.service";
import * as magicBoxesService from "../magicBoxes/magicBoxes.service";
import type { ListStorefrontProductsQuery, MyOrdersQuery, PushSubscribeInput, SendChatMessageInput, TrackPageViewInput } from "./storefront.schema";
import type { CreateStorefrontOrderInput } from "../orders/orders.schema";

// What the shop pays its agents is none of the buyer's business - and on
// the storefront "the buyer" is anyone who knows the phone number.
function withoutAgentFields<T extends object>(order: T): Omit<T, "agentId" | "agentBonus" | "agentBonusAccruedAt" | "agentPayoutId"> {
  const { agentId: _a, agentBonus: _b, agentBonusAccruedAt: _c, agentPayoutId: _d, ...rest } = order as T & Record<string, unknown>;
  return rest as Omit<T, "agentId" | "agentBonus" | "agentBonusAccruedAt" | "agentPayoutId">;
}

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
  const { agentRef, ...input } = req.body as CreateStorefrontOrderInput;
  const order = await ordersService.createOrder(req.tenant!.id, null, input, {
    minOrderAmount: req.tenant!.minOrderAmount,
    agentRef,
  });
  res.status(201).json({ order: withoutAgentFields(order) });
}

export async function trackPageView(req: Request, res: Response): Promise<void> {
  await storefrontService.trackPageView(req.tenant!.id, req.body as TrackPageViewInput);
  res.status(204).send();
}

export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const { phone } = req.query as unknown as MyOrdersQuery;
  const orders = await storefrontService.getMyOrders(req.tenant!.id, phone);
  res.json({ orders: orders.map(withoutAgentFields) });
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
  const { name, logoUrl, themeColor, description, inn, companyName, contactPhone, instagram, facebook, youtube, minOrderAmount, paymentMethods, deliveryMinDays, deliveryMaxDays } = req.tenant!;
  res.json({ name, logoUrl, themeColor, description, inn, companyName, contactPhone, instagram, facebook, youtube, minOrderAmount, paymentMethods, deliveryMinDays, deliveryMaxDays });
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

export async function listMagicBoxes(req: Request, res: Response): Promise<void> {
  res.json(await magicBoxesService.listActiveMagicBoxes(req.tenant!.id));
}
