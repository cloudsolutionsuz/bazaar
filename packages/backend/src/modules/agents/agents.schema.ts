import { z } from "zod";
import { orderStatusValues } from "../orders/orders.schema";
import { uzPhoneSchema } from "../../utils/phoneSchema";

// Stored in users.email (the login identifier column) - "@" is excluded so
// an agent login can never collide with, or be mistaken for, a staff email.
const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,50}$/, "Login must be 3-50 characters: latin letters, digits, dot, dash or underscore");

const passwordSchema = z.string().min(6).max(72);

const socialSchema = z.string().trim().max(255).nullable().optional();

const bonusTypeSchema = z.enum(["PERCENT", "FIXED"]);
const bonusValueSchema = z.number().int().min(0).max(1_000_000_000);

interface BonusTerms {
  bonusType?: "PERCENT" | "FIXED";
  bonusValue?: number;
}

const percentWithinRange = (data: BonusTerms) => data.bonusType !== "PERCENT" || (data.bonusValue ?? 0) <= 100;
const percentRefinement = { message: "A percent bonus cannot exceed 100", path: ["bonusValue"] };

export const createAgentSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    phone: uzPhoneSchema,
    telegram: socialSchema,
    instagram: socialSchema,
    youtube: socialSchema,
    tiktok: socialSchema,
    login: loginSchema,
    password: passwordSchema,
    bonusType: bonusTypeSchema,
    bonusValue: bonusValueSchema,
  })
  .refine(percentWithinRange, percentRefinement);

// bonusType and bonusValue travel together so a percent can never be left
// holding a value that only made sense as a fixed sum (or the reverse).
export const updateAgentSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200).optional(),
    phone: uzPhoneSchema.optional(),
    telegram: socialSchema,
    instagram: socialSchema,
    youtube: socialSchema,
    tiktok: socialSchema,
    login: loginSchema.optional(),
    password: passwordSchema.optional(),
    bonusType: bonusTypeSchema.optional(),
    bonusValue: bonusValueSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => (data.bonusType === undefined) === (data.bonusValue === undefined), {
    message: "bonusType and bonusValue must be sent together",
    path: ["bonusValue"],
  })
  .refine(percentWithinRange, percentRefinement);

// agentIds omitted = every agent of the shop.
export const bulkBonusSchema = z
  .object({
    bonusType: bonusTypeSchema,
    bonusValue: bonusValueSchema,
    agentIds: z.array(z.string().uuid()).min(1).max(1000).optional(),
  })
  .refine(percentWithinRange, percentRefinement);

export const createPayoutSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(1000),
  cashRegisterId: z.string().uuid(),
});

const periodFields = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  agentId: z.string().uuid().optional(),
};

export const agentSalesQuerySchema = z.object({
  ...periodFields,
  status: z.enum(orderStatusValues).optional(),
  // paid = bonus already paid out; unpaid = archived, bonus earned, not paid yet.
  payment: z.enum(["paid", "unpaid"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const agentPeriodQuerySchema = z.object(periodFields);

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type BulkBonusInput = z.infer<typeof bulkBonusSchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type AgentSalesQuery = z.infer<typeof agentSalesQuerySchema>;
export type AgentPeriodQuery = z.infer<typeof agentPeriodQuerySchema>;
