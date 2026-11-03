import { createHmac, timingSafeEqual } from "node:crypto";
import { whatsapp } from "@/server/container";
import { handle, json, readText } from "@/server/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const token = params.get("hub.verify_token") || "";
  if (
    !expected ||
    params.get("hub.mode") !== "subscribe" ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return new Response("Forbidden", { status: 403 });
  return new Response(params.get("hub.challenge") || "", {
    headers: { "Cache-Control": "no-store" },
  });
}
const eventSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.string(),
                  timestamp: z.string(),
                  recipient_id: z.string().optional(),
                  biz_opaque_callback_data: z.string().optional(),
                  errors: z
                    .array(z.object({ code: z.number().optional() }))
                    .optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});
export async function POST(request: Request) {
  return handle(async () => {
    const raw = await readText(request, 1024 * 1024);
    const secret = process.env.WHATSAPP_APP_SECRET;
    const signature = request.headers.get("x-hub-signature-256") || "";
    if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature))
      return json({ error: "Invalid signature." }, 401);
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return json({ error: "Invalid signature." }, 401);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid event." }, 400);
    }
    const event = eventSchema.parse(data);
    for (const entry of event.entry)
      for (const change of entry.changes)
        for (const status of change.value.statuses || [])
          await whatsapp.webhook(
            status,
            change.value.metadata?.phone_number_id || "",
          );
    return json({ received: true });
  });
}
