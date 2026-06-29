import { z } from "zod";

export const sendStaffMessageSchema = z.object({
  text: z.string().min(1).max(2000),
});

export type SendStaffMessageInput = z.infer<typeof sendStaffMessageSchema>;
