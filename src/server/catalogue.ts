import { Prisma } from "@prisma/client";
import { db, transaction } from "./db";
import { productSchema, stockSchema } from "./validation";
import { HttpError } from "./http";
import type { Product } from "@/lib/products";
const include = {
  product: { include: { category: true } },
  inventory: true,
} satisfies Prisma.ProductVariantInclude;
type Row = Prisma.ProductVariantGetPayload<{ include: typeof include }>;
function publicProduct(v: Row): Product {
  return {
    id: v.id,
    name: v.product.name,
    hindiName: v.product.hindiName,
    description: v.product.description,
    category: v.product.categoryId,
    weight: Number(v.weight),
    unit: v.unit as Product["unit"],
    price: v.pricePaise / 100,
    image: v.image,
    illustration: v.illustration as Product["illustration"],
    tone: v.tone as Product["tone"],
    badge: v.badge || undefined,
    available: v.available && (v.inventory?.quantity ?? 0) > 0,
  };
}
export async function catalogue(admin = false) {
  const [rows, categories, settings] = await Promise.all([
    db.productVariant.findMany({
      where: {
        active: true,
        product: { active: true, category: { active: true } },
      },
      include,
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    db.storeSettings.findUnique({
      where: { id: "store" },
      select: { name: true, contact: true, location: true, hours: true },
    }),
  ]);
  return {
    products: rows.map((v) =>
      admin
        ? {
            ...publicProduct(v),
            available: v.available,
            productId: v.productId,
            version: v.version,
          }
        : publicProduct(v),
    ),
    categories,
    settings,
  };
}
export async function saveProduct(input: unknown, adminId: string) {
  const p = productSchema.parse(input);
  return transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: p.category },
    });
    if (!category?.active)
      throw new HttpError(400, "Choose an active category");
    const existing = await tx.productVariant.findUnique({
      where: { id: p.id },
    });
    const details = {
      name: p.name,
      hindiName: p.hindiName,
      description: p.description,
      categoryId: p.category,
    };
    const variant = {
      weight: p.weight,
      unit: p.unit,
      pricePaise: Math.round(p.price * 100),
      image: p.image,
      illustration: p.illustration,
      tone: p.tone,
      badge: p.badge ?? "",
      available: p.available,
    };
    if (existing) {
      if (p.version === undefined)
        throw new HttpError(409, "Refresh this product before editing");
      const changed = await tx.productVariant.updateMany({
        where: { id: p.id, version: p.version, active: true },
        data: { ...variant, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new HttpError(
          409,
          "This product was edited elsewhere. Refresh and try again.",
        );
      await tx.product.update({
        where: { id: existing.productId },
        data: details,
      });
    } else {
      // A new package can refer to an existing product; shared details remain with that product.
      const parent = p.productId
        ? await tx.product.findUniqueOrThrow({
            where: { id: p.productId, active: true },
          })
        : await tx.product.create({ data: details });
      await tx.productVariant.create({
        data: {
          id: p.id,
          sku: p.id,
          productId: parent.id,
          ...variant,
          inventory: { create: {} },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        adminId,
        action: existing ? "PRODUCT_EDIT" : "PRODUCT_CREATE",
        entityId: p.id,
        details: { pricePaise: variant.pricePaise },
      },
    });
    return { id: p.id };
  });
}
export async function archiveProduct(id: string, adminId: string) {
  return transaction(async (tx) => {
    await tx.productVariant.update({
      where: { id },
      data: { active: false, version: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { adminId, action: "PRODUCT_ARCHIVE", entityId: id },
    });
  });
}
export async function adjustStock(input: unknown, adminId: string) {
  const { updates } = stockSchema.parse(input);
  return transaction(async (tx) => {
    for (const update of [...updates].sort((a, b) =>
      a.variantId.localeCompare(b.variantId),
    )) {
      const previous = await tx.inventoryBalance.findUniqueOrThrow({
        where: { variantId: update.variantId },
      });
      const quantity =
        update.mode === "set"
          ? update.quantity
          : previous.quantity +
            (update.mode === "increase" ? update.quantity : -update.quantity);
      if (quantity < 0 || quantity > 1000000)
        throw new HttpError(
          400,
          "Stock must be a nonnegative whole number, at most 1,000,000",
        );
      const result = await tx.inventoryBalance.updateMany({
        where: { variantId: update.variantId, version: update.version },
        data: { quantity, version: { increment: 1 }, updatedById: adminId },
      });
      if (!result.count)
        throw new HttpError(
          409,
          "Stock changed in another session. Refresh before saving. No changes were saved.",
        );
      await tx.stockAdjustment.create({
        data: {
          variantId: update.variantId,
          previousQuantity: previous.quantity,
          newQuantity: quantity,
          difference: quantity - previous.quantity,
          adminId,
          reason: update.reason,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        adminId,
        action: "MANUAL_STOCK_EDIT",
        details: { variants: updates.map((u) => u.variantId) },
      },
    });
    return { updated: updates.length };
  });
}
export async function availability(
  items: { variantId: string; quantity: number }[],
) {
  const rows = await db.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include,
  });
  return items.map((item) => {
    const v = rows.find((v) => v.id === item.variantId);
    return {
      variantId: item.variantId,
      available: !!(
        v?.active &&
        v.product.active &&
        v.product.category.active &&
        v.available &&
        (v.inventory?.quantity ?? 0) >= item.quantity
      ),
    };
  });
}
