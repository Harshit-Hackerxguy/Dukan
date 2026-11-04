import "dotenv/config";
import { db } from "../src/server/db";
import { phoneSchema } from "../src/server/validation";
async function main() {
  const phone = phoneSchema.parse(process.env.ADMIN_PHONE);
  await db.$transaction(async (tx) => {
    const old = await tx.admin.findMany({
      where: { active: true, phone: { not: phone } },
    });
    if (old.length && !process.argv.includes("--rotate-admin"))
      throw new Error(
        "Admin identity differs. Use --rotate-admin explicitly to revoke prior sessions and change the authorized identity.",
      );
    if (old.length) {
      await tx.admin.updateMany({
        where: { id: { in: old.map((a) => a.id) } },
        data: { active: false },
      });
      await tx.adminSession.deleteMany({
        where: { adminId: { in: old.map((a) => a.id) } },
      });
    }
    const admin = await tx.admin.upsert({
      where: { phone },
      create: { phone, name: process.env.ADMIN_NAME || "Store owner" },
      update: { active: true, name: process.env.ADMIN_NAME || "Store owner" },
    });
    await tx.storeSettings.upsert({
      where: { id: "store" },
      create: {
        whatsappRecipient: phoneSchema.parse(
          process.env.WHATSAPP_RECIPIENT || phone,
        ),
      },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: old.length ? "ADMIN_IDENTITY_ROTATION" : "ADMIN_BOOTSTRAP",
      },
    });
  });
  console.log(
    "Admin and store configured; existing catalogue and stock preserved.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
