import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireActiveTenant, requireResolvedTenant } from "../../middleware/requireTenant";
import { validateBody, validateQuery } from "../../middleware/validate";
import { listStorefrontProductsQuerySchema, myOrdersQuerySchema, sendChatMessageSchema, trackPageViewSchema } from "./storefront.schema";
import { createOrderSchema } from "../orders/orders.schema";
import * as storefrontController from "./storefront.controller";

export const storefrontRouter = Router();

storefrontRouter.use(requireResolvedTenant, requireActiveTenant);

storefrontRouter.get("/categories", asyncHandler(storefrontController.listCategories));
storefrontRouter.get("/products", validateQuery(listStorefrontProductsQuerySchema), asyncHandler(storefrontController.listProducts));
storefrontRouter.get("/products/:id", asyncHandler(storefrontController.getProduct));
storefrontRouter.post("/orders", validateBody(createOrderSchema), asyncHandler(storefrontController.createOrder));
storefrontRouter.get("/orders/by-phone", validateQuery(myOrdersQuerySchema), asyncHandler(storefrontController.getMyOrders));
storefrontRouter.get("/chat", validateQuery(myOrdersQuerySchema), asyncHandler(storefrontController.getChatMessages));
storefrontRouter.post("/chat", validateBody(sendChatMessageSchema), asyncHandler(storefrontController.sendChatMessage));
storefrontRouter.get("/banners", asyncHandler(storefrontController.listBanners));
storefrontRouter.get("/meta", asyncHandler(storefrontController.getMeta));
storefrontRouter.post(
  "/analytics/track",
  validateBody(trackPageViewSchema),
  asyncHandler(storefrontController.trackPageView),
);
