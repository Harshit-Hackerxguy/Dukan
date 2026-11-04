import { cookies } from "next/headers";
import { z } from "zod";
import { catalogue, availability } from "@/server/catalogue";
import { checkout } from "@/server/orders";
import {
  handle,
  json,
  body,
  readBody,
  sameOrigin,
  rateLimit,
  clientKey,
  HttpError,
  hash,
} from "@/server/http";
import {
  requireAdmin,
  requestOtp,
  verifyOtp,
  COOKIE,
  cookieOptions,
} from "@/server/auth";
import { adminApi } from "@/server/admin-api";
import { applyWebhook, verifyWebhook } from "@/server/delivery";
import { db } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(async () => {
    const { path } = await context.params;
    const route = path.join("/");
    if (route === "webhooks/whatsapp") {
      if (req.method === "GET") {
        const q = new URL(req.url).searchParams;
        if (
          !process.env.WHATSAPP_VERIFY_TOKEN ||
          q.get("hub.mode") !== "subscribe" ||
          q.get("hub.verify_token") !== process.env.WHATSAPP_VERIFY_TOKEN
        )
          throw new HttpError(403, "Verification failed");
        return new Response(q.get("hub.challenge"), {
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
      if (Number(req.headers.get("content-length")) > 200000)
        throw new HttpError(413, "Webhook too large");
      const raw = await readBody(req, 200000);
      verifyWebhook(raw, req.headers.get("x-hub-signature-256"));
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new HttpError(400, "Invalid JSON");
      }
      await applyWebhook(payload);
      return json({ ok: true });
    }
    if (!["GET", "HEAD"].includes(req.method)) sameOrigin(req);
    if (path[0] === "admin")
      return adminApi(req, path.slice(1), await requireAdmin());
    if (req.method === "GET" && route === "catalogue")
      return json(await catalogue());
    if (req.method === "POST" && route === "availability") {
      await rateLimit("availability", clientKey(req), 600, 60);
      const data = z
        .object({
          items: z
            .array(
              z.object({
                variantId: z.string().max(100),
                quantity: z.number().int().min(1).max(99),
              }),
            )
            .min(1)
            .max(50),
        })
        .parse(await body(req));
      return json(await availability(data.items));
    }
    if (req.method === "POST" && route === "checkout") {
      await rateLimit("checkout", clientKey(req), 30, 600);
      return json(
        await checkout(
          await body(req),
          req.headers.get("idempotency-key") || "",
        ),
        201,
      );
    }
    if (req.method === "POST" && route === "auth/request") {
      await rateLimit("otp-request", clientKey(req), 10, 600);
      const data = z.object({ phone: z.string() }).parse(await body(req));
      return json(await requestOtp(data.phone));
    }
    if (req.method === "POST" && route === "auth/verify") {
      await rateLimit("otp-verify", clientKey(req), 20, 600);
      const token = await verifyOtp(await body(req));
      (await cookies()).set(COOKIE, token, cookieOptions);
      return json({ ok: true });
    }
    if (req.method === "POST" && route === "auth/logout") {
      const admin = await requireAdmin();
      const jar = await cookies();
      const token = jar.get(COOKIE)?.value;
      if (token)
        await db.adminSession.deleteMany({ where: { tokenHash: hash(token) } });
      jar.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
      await db.auditLog.create({
        data: { adminId: admin.id, action: "ADMIN_LOGOUT" },
      });
      return json({ ok: true });
    }
    throw new HttpError(404, "Not found");
  });
}
export { route as GET, route as POST, route as PATCH, route as DELETE };
