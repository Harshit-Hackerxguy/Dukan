import "dotenv/config";
import { db } from "../src/server/db";
import { phoneSchema } from "../src/server/validation";
import { categories, initialProducts } from "./seed-data";
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Development seed is disabled in production. Use db:bootstrap instead.",
    );
  for (const c of categories)
    await db.category.upsert({ where: { id: c.id }, create: c, update: {} });
  const phone = phoneSchema.parse(process.env.ADMIN_PHONE);
  const admin = await db.admin.upsert({
    where: { phone },
    create: { phone, name: process.env.ADMIN_NAME || "Store owner" },
    update: {},
  });
  await db.storeSettings.upsert({
    where: { id: "store" },
    create: {},
    update: {},
  });
  for (const p of initialProducts) {
    await db.$transaction(async (tx) => {
      if (await tx.productVariant.findUnique({ where: { id: p.id } })) return;
      await tx.product.create({
        data: {
          id: p.id,
          name: p.name,
          hindiName: p.hindiName,
          description: p.description,
          categoryId: p.category,
          variants: {
            create: {
              id: p.id,
              sku: p.id,
              weight: p.weight,
              unit: p.unit,
              pricePaise: p.price * 100,
              image: p.image,
              illustration: p.illustration,
              tone: p.tone,
              badge: p.badge,
              available: p.available,
              inventory: { create: { quantity: 100, updatedById: admin.id } },
              adjustments: {
                create: {
                  previousQuantity: 0,
                  newQuantity: 100,
                  difference: 100,
                  adminId: admin.id,
                  reason: "Development seed stock",
                },
              },
            },
          },
        },
      });
    });
  }
  console.log("Development seed applied without overwriting existing records.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
