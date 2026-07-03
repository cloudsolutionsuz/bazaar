import { z } from "zod";
import { UZBEKISTAN_REGIONS } from "../../data/uzbekistanRegions";

const REGION_CODES = UZBEKISTAN_REGIONS.map((r) => r.code);

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  regions: z.array(z.string()).min(1).refine(
    (arr) => arr.every((r) => REGION_CODES.includes(r)),
    { message: "Invalid region code" },
  ),
  cost: z.number().int().min(0),
  freeAbove: z.number().int().min(0).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const getShippingCostQuerySchema = z.object({
  region: z.string().min(1),
  amount: z.coerce.number().int().min(0),
});

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
export type GetShippingCostQuery = z.infer<typeof getShippingCostQuerySchema>;
