import { z } from "zod";

export const inviteEmployeeSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(["MANAGER", "CASHIER"]),
});

export const updateEmployeeSchema = z.object({
  role: z.enum(["MANAGER", "CASHIER"]),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
