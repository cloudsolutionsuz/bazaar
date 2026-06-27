import { z } from "zod";
import { UZBEKISTAN_REGIONS } from "../../data/uzbekistanRegions";
import { normalizePhone } from "../../utils/phone";

export const orderItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const REGION_CODES = UZBEKISTAN_REGIONS.map((r) => r.code) as [string, ...string[]];
const DISTRICTS_BY_REGION = new Map(UZBEKISTAN_REGIONS.map((r) => [r.code, new Set(r.districts.map((d) => d.code))]));

const phoneSchema = z.string().min(3).max(30).transform(normalizePhone);

export const createOrderSchema = z
  .object({
    customerName: z.string().min(1).max(200),
    customerPhone: phoneSchema,
    additionalPhones: z.array(phoneSchema).max(5).optional(),
    addressRegion: z.enum(REGION_CODES),
    addressDistrict: z.string().min(1).max(100),
    addressMahalla: z.string().min(1).max(200),
    addressNote: z.string().max(500).optional(),
    paymentMethod: z.string().max(50).optional(),
    items: z.array(orderItemInputSchema).min(1),
  })
  .refine((data) => DISTRICTS_BY_REGION.get(data.addressRegion)?.has(data.addressDistrict) ?? false, {
    message: "addressDistrict does not belong to addressRegion",
    path: ["addressDistrict"],
  });

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
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
