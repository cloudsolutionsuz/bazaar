import { z } from "zod";

export const orderItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(3).max(30),
  customerAddress: z.string().max(500).optional(),
  paymentMethod: z.string().max(50).optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const orderStatusValues = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(orderStatusValues),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
