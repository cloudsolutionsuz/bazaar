import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
