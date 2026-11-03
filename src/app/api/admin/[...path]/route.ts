import { uow, products, inventory, whatsapp } from "@/server/container";
import { body, handle, json, requireAdmin, sameOrigin } from "@/server/http";
import {
  adminPhone,
  mockAuthEnabled,
  whatsappConfiguration,
} from "@/server/config";
import { orderStatusSchema } from "@/server/validation";
import { AppError } from "@/server/errors";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    await requireAdmin();
    const { path } = await context.params;
    if (path.join("/") === "products") return json(await products.adminList());
    if (path.join("/") === "inventory") return json(await inventory.list());
    if (path.join("/") === "orders")
      return json(
        await uow.read((r) => ({
          orders: r.orders
            .list()
            .map(
              ({
                pdfBase64: _p,
                idempotencyHash: _i,
                requestHash: _r,
                ...order
              }) => order,
            )
            .reverse(),
        })),
      );
    if (path.join("/") === "settings") {
      const c = whatsappConfiguration();
      return json({
        settings: await uow.read((r) => r.settings.get()),
        adminPhone: adminPhone(),
        mockAuth: mockAuthEnabled(),
        whatsapp: {
          mode: c.mode,
          configured: c.configured,
          senderId: c.sender,
          template: c.template,
          language: c.language,
        },
      });
    }
    if (path.length === 3 && path[0] === "orders" && path[2] === "pdf") {
      const order = await uow.read((r) => r.orders.get(path[1]));
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      return new Response(Buffer.from(order.pdfBase64, "base64"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${order.memoNumber}.pdf"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return json({ error: "Not found." }, 404);
  });
}
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const actor = await requireAdmin();
    const { path } = await context.params;
    const input = await body(request);
    if (path.join("/") === "products") await products.save(input);
    else if (path.join("/") === "categories")
      await products.saveCategory(input);
    else if (path.join("/") === "inventory")
      await inventory.adjust(input, actor);
    else if (path.join("/") === "settings") await products.saveSettings(input);
    else if (path.length === 3 && path[0] === "orders" && path[2] === "retry")
      return json({ whatsapp: await whatsapp.dispatch(path[1], true) });
    else if (
      path.length === 3 &&
      path[0] === "orders" &&
      path[2] === "status"
    ) {
      const { status } = orderStatusSchema.parse(input);
      await uow.transaction((r) => {
        const order = r.orders.get(path[1]);
        if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
        r.orders.save({ ...order, status }); // Status changes never touch inventory.
      });
    } else return json({ error: "Not found." }, 404);
    return json({ ok: true });
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    await requireAdmin();
    sameOrigin(request);
    const { path } = await context.params;
    if (path.length === 2 && path[0] === "products")
      await products.archive(path[1]);
    else if (path.length === 2 && path[0] === "categories")
      await products.deleteCategory(path[1]);
    else return json({ error: "Not found." }, 404);
    return json({ ok: true });
  });
}
