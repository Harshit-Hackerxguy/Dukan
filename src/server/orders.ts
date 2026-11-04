import { randomUUID } from "node:crypto";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { db, transaction } from "./db";
import { checkoutSchema } from "./validation";
import { hash, HttpError } from "./http";
import { generateMemo } from "./memo";
function receipt(
  orderId: string,
  memoNumber: string,
  totalPaise: number,
  createdAt: Date,
  whatsappStatus: string,
) {
  return {
    orderId,
    memoNumber,
    totalPaise,
    createdAt: createdAt.toISOString(),
    whatsappStatus,
    message:
      "Your order request has been recorded. Product availability is subject to confirmation by the store.",
  };
}
export async function checkout(input: unknown, idempotencyKey: string) {
  z.string().uuid().parse(idempotencyKey);
  const data = checkoutSchema.parse(input);
  data.items.sort((a, b) => a.variantId.localeCompare(b.variantId));
  const idempotencyHash = hash(idempotencyKey),
    payloadHash = hash(JSON.stringify(data));
  return transaction(async (tx) => {
    const previous = await tx.orderRequest.findUnique({
      where: { idempotencyHash },
      include: { memo: { select: { number: true, deliveryStatus: true } } },
    });
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new HttpError(
          409,
          "This submission key has already been used for a different request",
        );
      return receipt(
        previous.id,
        previous.memo!.number,
        previous.totalPaise,
        previous.createdAt,
        previous.memo!.deliveryStatus,
      );
    }
    const settings = await tx.storeSettings.findUnique({
      where: { id: "store" },
    });
    if (!settings) throw new HttpError(503, "Store setup is incomplete");
    const variants = await tx.productVariant.findMany({
      where: { id: { in: data.items.map((i) => i.variantId) } },
      include: { product: { include: { category: true } }, inventory: true },
    });
    const items = data.items.map((item) => {
      const v = variants.find((v) => v.id === item.variantId);
      if (
        !v?.active ||
        !v.product.active ||
        !v.product.category.active ||
        !v.available ||
        (v.inventory?.quantity ?? 0) < item.quantity
      )
        throw new HttpError(
          409,
          "Requested quantity unavailable. Please review your bag.",
        );
      if (v.pricePaise !== item.expectedPricePaise)
        throw new HttpError(
          409,
          "A product price changed. Refresh your bag and review the new total.",
        );
      return {
        variantId: v.id,
        productId: v.productId,
        name: v.product.name,
        hindiName: v.product.hindiName,
        packaging: `${v.weight} ${v.unit}`,
        quantity: item.quantity,
        unitPricePaise: v.pricePaise,
        lineTotalPaise: v.pricePaise * item.quantity,
      };
    });
    const totalPaise = items.reduce((sum, i) => sum + i.lineTotalPaise, 0);
    if (totalPaise > 2000000000)
      throw new HttpError(
        400,
        "Order value exceeds the supported limit. Contact the store.",
      );
    const orderId = randomUUID(),
      memoId = randomUUID(),
      now = new Date();
    const number = `CM-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
    const pdf = await generateMemo({
      number,
      createdAt: now,
      customerName: data.name,
      customerPhone: data.phone,
      storeName: settings.name,
      storeContact: settings.contact,
      storeLocation: settings.location,
      items,
      totalPaise,
    });
    const customer = await tx.customer.upsert({
      where: { phone: data.phone },
      create: { name: data.name, phone: data.phone },
      update: { name: data.name },
    });
    await tx.orderRequest.create({
      data: {
        id: orderId,
        createdAt: now,
        idempotencyHash,
        payloadHash,
        customerId: customer.id,
        customerName: data.name,
        customerPhone: data.phone,
        totalPaise,
        items: { create: items },
        memo: {
          create: {
            id: memoId,
            createdAt: now,
            number,
            storageRef: `db:cashMemo/${memoId}`,
            pdf: new Uint8Array(pdf),
            recipientPhone: settings.whatsappRecipient,
            job: { create: {} },
          },
        },
      },
    });
    // Deliberately no inventory writes here or in any order/delivery operation.
    return receipt(orderId, number, totalPaise, now, "PENDING");
  });
}
export async function setOrderStatus(
  id: string,
  status: unknown,
  adminId: string,
) {
  const next = z.nativeEnum(OrderStatus).parse(status);
  return transaction(async (tx) => {
    const order = await tx.orderRequest.update({
      where: { id },
      data: { status: next },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: "ORDER_STATUS",
        entityId: id,
        details: { status: next },
      },
    });
    return { id: order.id, status: order.status };
  });
}
export async function listOrders(search = "", skip = 0) {
  return db.orderRequest.findMany({
    where: search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" } },
            { customerPhone: { contains: search } },
            { memo: { number: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    skip,
    take: 50,
    include: {
      items: true,
      memo: {
        select: {
          id: true,
          number: true,
          documentStatus: true,
          deliveryStatus: true,
          createdAt: true,
          attempts: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      },
    },
  });
}
