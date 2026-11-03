import { z } from "zod";

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (s) => !/[\u0000-\u001f\u007f]/.test(s),
      "Use plain text without control characters.",
    );
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .transform((s) => (/^\d{10}$/.test(s) ? `+91${s}` : s))
  .pipe(
    z
      .string()
      .regex(
        /^\+91[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number.",
      ),
  );
export const checkoutSchema = z
  .object({
    name: text(2, 80),
    phone: phoneSchema,
    items: z
      .array(
        z
          .object({
            productId: text(1, 100),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (s) => new Set(s.items.map((i) => i.productId)).size === s.items.length,
    "Each product may appear only once.",
  );
export const productSchema = z
  .object({
    id: text(1, 100).regex(/^[a-zA-Z0-9-]+$/),
    name: text(1, 100),
    hindiName: text(0, 100),
    category: text(1, 100),
    weight: z.number().positive().max(100000),
    unit: z.enum(["kg", "g", "L"]),
    price: z
      .number()
      .positive()
      .max(10000000)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
        "Use at most two decimal places.",
      ),
    image: z
      .string()
      .max(700000)
      .refine(
        (s) =>
          !s ||
          /^https:\/\//.test(s) ||
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s),
        "Use an HTTPS image URL or a JPG, PNG, or WebP upload.",
      ),
    illustration: z.enum(["rice", "sugar", "potatoes"]),
    tone: z.enum(["green", "ochre", "plum", "blue", "cream"]),
    description: text(0, 1000),
    available: z.boolean(),
    badge: text(0, 30).optional(),
  })
  .strict();
export const categorySchema = z
  .object({
    id: text(1, 80).regex(/^[a-z0-9-]+$/),
    name: text(2, 60),
    description: text(0, 120),
    illustration: z.enum(["rice", "sugar", "potatoes"]),
  })
  .strict();
export const inventorySchema = z
  .object({
    reason: text(3, 200),
    changes: z
      .array(
        z
          .object({
            productId: text(1, 100),
            quantity: z.number().int().min(0).max(1000000),
            expectedQuantity: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .refine(
    (v) => new Set(v.changes.map((c) => c.productId)).size === v.changes.length,
    "Duplicate products.",
  );
export const settingsSchema = z
  .object({
    name: text(1, 80),
    contact: text(0, 120),
    location: text(0, 160),
    hours: text(0, 80),
    whatsappRecipient: z.union([z.literal(""), phoneSchema]),
    whatsappConsent: z.boolean(),
  })
  .strict();
export const orderStatusSchema = z
  .object({
    status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
  })
  .strict();
export const otpRequestSchema = z.object({ phone: phoneSchema }).strict();
export const otpVerifySchema = z
  .object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) })
  .strict();
