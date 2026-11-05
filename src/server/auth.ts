import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db, transaction } from "./db";
import { hash, HttpError, rateLimit } from "./http";
import { phoneSchema } from "./validation";
import { adminAccounts, isAdminPhone } from "./admin-accounts";
import { z } from "zod";
const derive = promisify(scrypt);
export const COOKIE = "dukan_admin";
export const CUSTOMER_COOKIE = "dukan_customer";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 8 * 60 * 60,
};
export async function getAdmin(token?: string) {
  token ??= (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { admin: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.admin.active ||
    !isAdminPhone(session.admin.phone)
  )
    return null;
  return session.admin;
}
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new HttpError(401, "Admin sign-in required");
  return admin;
}
export async function loginAdmin(input: unknown) {
  const data = z
    .object({ phone: phoneSchema, password: z.string().min(1).max(128) })
    .parse(input);
  await rateLimit("admin-password", hash(data.phone), 10, 600);
  const admin = await db.admin.findUnique({ where: { phone: data.phone } });
  const encoded = admin?.passwordHash || adminAccounts[0].passwordHash;
  const [, salt, digest] = encoded.split(":");
  const actual = (await derive(data.password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  if (
    !admin?.active ||
    !isAdminPhone(data.phone) ||
    !admin.passwordHash ||
    expected.length !== actual.length ||
    !timingSafeEqual(actual, expected)
  )
    throw new HttpError(401, "Invalid mobile number or password");
  return transaction(async (tx) => {
    const token = randomBytes(32).toString("hex");
    await tx.adminSession.create({
      data: {
        adminId: admin.id,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + cookieOptions.maxAge * 1000),
      },
    });
    await tx.auditLog.create({
      data: { adminId: admin.id, action: "ADMIN_LOGIN" },
    });
    return token;
  });
}
export async function getCustomer(token?: string) {
  token ??= (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: hash(token) },
  });
  return session && session.expiresAt > new Date()
    ? { name: session.name, phone: session.phone }
    : null;
}
export async function loginCustomer(input: unknown) {
  const data = z
    .object({ name: z.string().trim().min(2).max(80), phone: phoneSchema })
    .parse(input);
  const token = randomBytes(32).toString("hex");
  await db.customerSession.create({
    data: {
      ...data,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + cookieOptions.maxAge * 1000),
    },
  });
  return token;
}
