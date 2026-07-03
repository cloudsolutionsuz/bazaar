import type { Request, Response } from "express";
import * as promoCodesService from "./promo-codes.service";
import type { CreatePromoCodeInput, ListPromoCodesQuery, ValidatePromoCodeQuery } from "./promo-codes.schema";

export async function listPromoCodes(req: Request, res: Response) {
  const result = await promoCodesService.listPromoCodes(req.tenant!.id, req.query as unknown as ListPromoCodesQuery);
  res.json(result);
}

export async function createPromoCode(req: Request, res: Response) {
  const promo = await promoCodesService.createPromoCode(req.tenant!.id, req.body as CreatePromoCodeInput);
  res.status(201).json({ promoCode: promo });
}

export async function deactivatePromoCode(req: Request, res: Response) {
  const promo = await promoCodesService.deactivatePromoCode(req.tenant!.id, req.params.id);
  res.json({ promoCode: promo });
}

// Storefront public endpoint
export async function validatePromoCode(req: Request, res: Response) {
  const query = req.query as unknown as ValidatePromoCodeQuery;
  const result = await promoCodesService.validatePromoCode(req.tenant!.id, String(query.code), Number(query.amount));
  res.json(result);
}
