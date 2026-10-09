import { z } from "zod";
import { toUzPhone } from "./phone";

// An Uzbek mobile number, typed with or without the +998 country code;
// parses to the stored digits-only form ("998901234567").
export const uzPhoneSchema = z
  .string()
  .max(30)
  .transform((raw, ctx) => {
    const phone = toUzPhone(raw);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone must be +998 followed by 9 digits" });
      return z.NEVER;
    }
    return phone;
  });
