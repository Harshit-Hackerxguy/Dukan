import { cookies } from "next/headers";
import { z } from "zod";
import { catalogue, availability } from "@/server/catalogue";
import { checkout } from "@/server/orders";
import {
  handle,
  json,
  body,
  sameOrigin,
  rateLimit,
  clientKey,
  HttpError,
  hash,
} from "@/server/http";
import {
  requireAdmin,
  loginAdmin,
  loginCustomer,
  getCustomer,
  getAdmin,
  CUSTOMER_COOKIE,
  COOKIE,
  cookieOptions,
} from "@/server/auth";
import { adminApi } from "@/server/admin-api";
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
      const customer = await getCustomer();
      if (!customer) throw new HttpError(401, "Please sign in before checkout");
      await rateLimit("checkout", clientKey(req), 30, 600);
      return json(
        await checkout(
          { ...(await body(req)), ...customer },
          req.headers.get("idempotency-key") || "",
        ),
        201,
      );
    }
    if (req.method === "GET" && route === "auth/session") {
      const admin = await getAdmin();
      return json({
        customer: await getCustomer(),
        admin: admin ? { name: admin.name } : null,
      });
    }
    if (req.method === "POST" && route === "auth/login") {
      await rateLimit("password-login", clientKey(req), 30, 600);
      const token = await loginAdmin(await body(req));
      (await cookies()).set(COOKIE, token, cookieOptions);
      return json({ ok: true });
    }
    if (req.method === "POST" && route === "auth/customer") {
      await rateLimit("customer-login", clientKey(req), 30, 600);
      const token = await loginCustomer(await body(req));
      const jar = await cookies();
      const previous = jar.get(CUSTOMER_COOKIE)?.value;
      if (previous)
        await db.customerSession.deleteMany({
          where: { tokenHash: hash(previous) },
        });
      jar.set(CUSTOMER_COOKIE, token, cookieOptions);
      return json({ ok: true });
    }
    if (req.method === "POST" && route === "auth/customer/logout") {
      const jar = await cookies();
      const token = jar.get(CUSTOMER_COOKIE)?.value;
      if (token)
        await db.customerSession.deleteMany({
          where: { tokenHash: hash(token) },
        });
      jar.set(CUSTOMER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
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
