import "dotenv/config";
import { db } from "../src/server/db";
import { adminAccounts } from "../src/server/admin-accounts";
async function main() {
  await db.$transaction(async (tx) => {
    const phones = adminAccounts.map((a) => a.phone);
    await tx.adminSession.deleteMany({
      where: { admin: { phone: { notIn: phones } } },
    });
    await tx.admin.updateMany({
      where: { phone: { notIn: phones } },
      data: { active: false },
    });
    for (const account of adminAccounts) {
      await tx.admin.upsert({
        where: { phone: account.phone },
        create: { ...account, name: "Store admin" },
        update: { active: true },
      });
    }
    await tx.storeSettings.upsert({
      where: { id: "store" },
      create: {},
      update: {},
    });
  });
  console.log("Both approved admins and store settings configured.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
