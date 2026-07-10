import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireActiveTenant, requireResolvedTenant } from "../../middleware/requireTenant";
import { validateBody, validateQuery } from "../../middleware/validate";
import { listStorefrontProductsQuerySchema, myOrdersQuerySchema, pushSubscribeSchema, sendChatMessageSchema, trackPageViewSchema } from "./storefront.schema";
import { createOrderSchema } from "../orders/orders.schema";
import { submitReviewSchema } from "../reviews/reviews.schema";
import * as storefrontController from "./storefront.controller";
import * as reviewsController from "../reviews/reviews.controller";

export const storefrontRouter = Router();

storefrontRouter.use(requireResolvedTenant, requireActiveTenant);

storefrontRouter.get("/categories", asyncHandler(storefrontController.listCategories));
storefrontRouter.get("/brands", asyncHandler(storefrontController.listBrands));
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
storefrontRouter.get("/push/vapid-key", asyncHandler(storefrontController.getPushVapidKey));
storefrontRouter.post("/push/subscribe", validateBody(pushSubscribeSchema), asyncHandler(storefrontController.subscribeToPush));
storefrontRouter.get("/products/:productId/reviews", asyncHandler(reviewsController.listStorefrontReviews));
storefrontRouter.post("/products/:productId/reviews", validateBody(submitReviewSchema), asyncHandler(reviewsController.submitReview));
storefrontRouter.get("/loyalty", asyncHandler(storefrontController.getLoyaltyBalance));
storefrontRouter.get("/magic-boxes", asyncHandler(storefrontController.listMagicBoxes));
