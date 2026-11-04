import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
export const phoneSchema = z
  .string()
  .max(30)
  .transform((value, ctx) => {
    const phone = parsePhoneNumberFromString(value, "IN");
    if (!phone?.isValid()) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
      return z.NEVER;
    }
    return phone.number.toString();
  });
export const idSchema = z.string().min(1).max(100);
export const productSchema = z.object({
  id: idSchema,
  productId: idSchema.optional(),
  version: z.number().int().nonnegative().optional(),
  name: z.string().trim().min(1).max(100),
  hindiName: z.string().trim().max(100).default(""),
  description: z.string().trim().max(1000).default(""),
  category: idSchema,
  weight: z.number().positive().max(100000),
  unit: z.enum(["kg", "g", "L"]),
  price: z
    .number()
    .positive()
    .max(1000000)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
      "Use at most two decimal places",
    ),
  image: z
    .string()
    .max(700000)
    .refine(
      (s) =>
        !s ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ||
        /^https:\/\/[^\s]+$/.test(s),
      "Use an HTTPS image URL or upload an image",
    )
    .default(""),
  illustration: z.enum(["rice", "sugar", "potatoes"]),
  tone: z.enum(["green", "ochre", "plum", "blue", "cream"]),
  badge: z.string().max(40).optional(),
  available: z.boolean(),
});
export const stockSchema = z.object({
  updates: z
    .array(
      z.object({
        variantId: idSchema,
        version: z.number().int().nonnegative(),
        mode: z.enum(["set", "increase", "decrease"]),
        quantity: z.number().int().min(0).max(1000000),
        reason: z.string().trim().max(300).default(""),
      }),
    )
    .min(1)
    .max(100)
    .refine(
      (rows) => new Set(rows.map((r) => r.variantId)).size === rows.length,
      "Duplicate products",
    ),
});
export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  items: z
    .array(
      z.object({
        variantId: idSchema,
        quantity: z.number().int().min(1).max(99),
        expectedPricePaise: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(50)
    .refine(
      (rows) => new Set(rows.map((r) => r.variantId)).size === rows.length,
      "Duplicate products",
    ),
});
