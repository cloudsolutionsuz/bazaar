import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateQuery } from "../../middleware/validate";
import { listReviewsQuerySchema } from "./reviews.schema";
import * as controller from "./reviews.controller";

const router = Router();

router.use(requireAuth(), requireRole("OWNER", "MANAGER"));

router.get("/", validateQuery(listReviewsQuerySchema), asyncHandler(controller.listAdminReviews));
router.patch("/:id/approve", asyncHandler(controller.approveReview));
router.delete("/:id", asyncHandler(controller.deleteReview));

export { router as reviewsRouter };
