import type { Request, Response } from "express";
import * as reviewsService from "./reviews.service";
import type { ListReviewsQuery, SubmitReviewInput } from "./reviews.schema";

export async function submitReview(req: Request, res: Response) {
  const review = await reviewsService.submitReview(
    req.tenant!.id,
    req.params.productId,
    req.body as SubmitReviewInput,
  );
  res.status(201).json({ review });
}

export async function listStorefrontReviews(req: Request, res: Response) {
  const result = await reviewsService.listStorefrontReviews(req.tenant!.id, req.params.productId);
  res.json(result);
}

export async function listAdminReviews(req: Request, res: Response) {
  const result = await reviewsService.listAdminReviews(req.tenant!.id, req.query as unknown as ListReviewsQuery);
  res.json(result);
}

export async function approveReview(req: Request, res: Response) {
  const review = await reviewsService.approveReview(req.tenant!.id, req.params.id);
  res.json({ review });
}

export async function deleteReview(req: Request, res: Response) {
  await reviewsService.deleteReview(req.tenant!.id, req.params.id);
  res.status(204).end();
}
