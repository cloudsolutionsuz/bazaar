import { z } from "zod";
import { UZBEKISTAN_REGIONS } from "../../data/uzbekistanRegions";
import { normalizePhone } from "../../utils/phone";
import { uzPhoneSchema } from "../../utils/phoneSchema";

export const saleUnitValues = ["PIECE", "BLOCK", "BOX"] as const;

// quantity counts whole units of `unit` (2 + BOX = two boxes); the service
// converts it to pieces using the product's packaging sizes.
export const orderItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(1_000_000),
  unit: z.enum(saleUnitValues).optional(),
  // How many pieces the buyer was told one unit holds. Optional, but when
  // sent it must still match the product - see createOrder.
  unitSize: z.number().int().positive().optional(),
});

const REGION_CODES = UZBEKISTAN_REGIONS.map((r) => r.code) as [string, ...string[]];
const DISTRICTS_BY_REGION = new Map(UZBEKISTAN_REGIONS.map((r) => [r.code, new Set(r.districts.map((d) => d.code))]));

const phoneSchema = z.string().min(3).max(30).transform(normalizePhone);

const orderFields = {
  customerName: z.string().min(1).max(200),
  customerPhone: phoneSchema,
  additionalPhones: z.array(phoneSchema).max(5).optional(),
  addressRegion: z.enum(REGION_CODES),
  addressDistrict: z.string().min(1).max(100),
  addressMahalla: z.string().min(1).max(200),
  addressNote: z.string().max(500).optional(),
  paymentMethod: z.string().max(50).optional(),
  promoCode: z.string().max(50).optional(),
  loyaltyPointsToRedeem: z.number().int().min(0).optional(),
  shippingCost: z.number().int().min(0).optional(),
  items: z.array(orderItemInputSchema).min(1).max(200),
  magicBoxIds: z.array(z.string()).optional(),
};

const districtBelongsToRegion = (data: { addressRegion: string; addressDistrict: string }) =>
  DISTRICTS_BY_REGION.get(data.addressRegion)?.has(data.addressDistrict) ?? false;
const districtRefinement = { message: "addressDistrict does not belong to addressRegion", path: ["addressDistrict"] };

export const createOrderSchema = z.object(orderFields).refine(districtBelongsToRegion, districtRefinement);

// Storefront checkout is stricter than a staff-created order: Uzbek numbers
// only, and a second contact number is mandatory. agentRef is the referral
// code of the agent whose link brought the buyer in (unknown codes are
// ignored rather than rejected - a stale link must never block a sale).
export const createStorefrontOrderSchema = z
  .object({
    ...orderFields,
    customerPhone: uzPhoneSchema,
    additionalPhones: z.array(uzPhoneSchema).min(1, "A second phone number is required").max(5),
    agentRef: z.string().trim().max(64).optional(),
  })
  .refine(districtBelongsToRegion, districtRefinement);

export const orderStatusValues = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "ARCHIVED"] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(orderStatusValues),
  courierName: z.string().max(200).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  includeArchived: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateStorefrontOrderInput = z.infer<typeof createStorefrontOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
