import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/server/db";
import { hash } from "../src/server/http";
export default async function setup() {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_e2e"))
    throw new Error(
      "Browser tests require an isolated DATABASE_URL ending in _e2e",
    );
  const admin = await db.admin.findUniqueOrThrow({
    where: { phone: process.env.ADMIN_PHONE },
  });
  const token = randomBytes(32).toString("hex");
  const expires = Math.floor(Date.now() / 1000) + 3600;
  await db.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hash(token),
      expiresAt: new Date(expires * 1000),
    },
  });
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/admin-state.json",
    JSON.stringify({
      cookies: [
        {
          name: "dukan_admin",
          value: token,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
          expires,
        },
      ],
      origins: [],
    }),
  );
  await db.$disconnect();
}
