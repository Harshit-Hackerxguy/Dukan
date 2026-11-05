import { z } from "zod";
import { db, transaction } from "./db";
import { body, HttpError, json } from "./http";
import {
  archiveProduct,
  catalogue,
  saveProduct,
  adjustStock,
} from "./catalogue";
import { listOrders, setOrderStatus } from "./orders";
export async function adminApi(
  req: Request,
  path: string[],
  admin: { id: string; phone: string; name: string },
) {
  const [resource, id] = path;
  const url = new URL(req.url);
  const skip = z.coerce
    .number()
    .int()
    .min(0)
    .max(1000000)
    .parse(url.searchParams.get("skip") || 0);
  const search = (url.searchParams.get("search") || "").slice(0, 100);
  if (req.method === "GET") {
    switch (resource) {
      case "session":
        return json({
          admin: { id: admin.id, name: admin.name, phone: admin.phone },
        });
      case "catalogue":
        return json(await catalogue(true));
      case "inventory":
        return json(
          await db.inventoryBalance.findMany({
            where: { variant: { active: true, product: { active: true } } },
            include: {
              variant: { include: { product: true } },
              updatedBy: { select: { name: true } },
            },
            orderBy: { variantId: "asc" },
          }),
        );
      case "adjustments":
        return json(
          await db.stockAdjustment.findMany({
            where: id ? { variantId: id } : {},
            take: 50,
            skip,
            orderBy: { createdAt: "desc" },
            include: {
              admin: { select: { name: true } },
              variant: { include: { product: true } },
            },
          }),
        );
      case "orders":
        return json(await listOrders(search, skip));
      case "customers": {
        const customers = await db.customer.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search } },
                ],
              }
            : {},
          take: 50,
          skip,
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { orders: true } },
            orders: {
              select: {
                id: true,
                createdAt: true,
                status: true,
                totalPaise: true,
                customerName: true,
              },
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
        });
        return json(
          await Promise.all(
            customers.map(async (customer) => ({
              ...customer,
              completedCount: await db.orderRequest.count({
                where: { customerId: customer.id, status: "COMPLETED" },
              }),
            })),
          ),
        );
      }
      case "settings":
        return json({
          ...(await db.storeSettings.findUniqueOrThrow({
            where: { id: "store" },
            select: { name: true, contact: true, location: true, hours: true },
          })),
          admin: { name: admin.name, phone: admin.phone },
        });
      case "dashboard": {
        const [activeProducts, categories, pending, outOfStock, recentOrders] =
          await Promise.all([
            db.productVariant.count({
              where: { active: true, product: { active: true } },
            }),
            db.category.count({ where: { active: true } }),
            db.orderRequest.count({ where: { status: "PENDING" } }),
            db.inventoryBalance.count({
              where: {
                quantity: 0,
                variant: { active: true, product: { active: true } },
              },
            }),
            db.orderRequest.findMany({
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                customerName: true,
                createdAt: true,
                totalPaise: true,
                status: true,
              },
            }),
          ]);
        return json({
          activeProducts,
          categories,
          pending,
          outOfStock,
          recentOrders,
        });
      }
      case "memos": {
        if (!id) throw new HttpError(404, "Memo not found");
        const memo = await db.cashMemo.findUniqueOrThrow({ where: { id } });
        await db.auditLog.create({
          data: { adminId: admin.id, action: "MEMO_VIEW", entityId: id },
        });
        return new Response(new Uint8Array(memo.pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${memo.number}.pdf"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
          },
        });
      }
    }
  }
  if (resource === "products" && req.method === "POST")
    return json(await saveProduct(await body(req), admin.id));
  if (resource === "products" && id && req.method === "DELETE") {
    await archiveProduct(id, admin.id);
    return json({ ok: true });
  }
  if (resource === "inventory" && req.method === "POST")
    return json(await adjustStock(await body(req), admin.id));
  if (resource === "orders" && id && req.method === "PATCH") {
    const data = z.object({ status: z.string() }).parse(await body(req));
    return json(await setOrderStatus(id, data.status, admin.id));
  }
  if (resource === "categories" && req.method === "POST") {
    const data = z
      .object({
        id: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(80),
        description: z.string().max(300).default(""),
        illustration: z.enum(["rice", "sugar", "potatoes"]).default("rice"),
        active: z.boolean().default(true),
      })
      .parse(await body(req));
    return json(
      await transaction(async (tx) => {
        const result = await tx.category.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        });
        await tx.auditLog.create({
          data: {
            adminId: admin.id,
            action: "CATEGORY_EDIT",
            entityId: data.id,
          },
        });
        return result;
      }),
    );
  }
  if (resource === "settings" && req.method === "POST") {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        contact: z.string().max(150),
        location: z.string().max(200),
        hours: z.string().max(150),
      })
      .parse(await body(req));
    await transaction(async (tx) => {
      await tx.storeSettings.update({ where: { id: "store" }, data });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "SETTINGS_EDIT",
        },
      });
    });
    return json({ ok: true });
  }
  throw new HttpError(404, "Not found");
}
