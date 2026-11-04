import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, transaction } from "./db";
import { hash, HttpError, rateLimit } from "./http";
import { phoneSchema } from "./validation";
import { z } from "zod";
export const COOKIE = "dukan_admin";
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
    session.admin.phone !== process.env.ADMIN_PHONE
  )
    return null;
  return session.admin;
}
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new HttpError(401, "Admin sign-in required");
  return admin;
}
function testAuth() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_TEST_AUTH === "true" &&
    !!process.env.TEST_OTP
  );
}
async function twilio(
  action: "Verifications" | "VerificationCheck",
  data: Record<string, string>,
) {
  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_VERIFY_SERVICE_SID: service,
  } = process.env;
  if (!sid || !token || !service)
    throw new HttpError(503, "Admin OTP provider is not configured");
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 400,
      "OTP verification could not be completed. Try again later.",
    );
  return response.json() as Promise<{ status: string }>;
}
export async function requestOtp(input: unknown) {
  const phone = phoneSchema.parse(input);
  await rateLimit("otp-phone", phone, 3, 600);
  if (phone !== process.env.ADMIN_PHONE) {
    await db.auditLog.create({
      data: { action: "AUTH_DENIED", details: { phoneHash: hash(phone) } },
    });
    throw new HttpError(403, "This number is not authorized for admin sign-in");
  }
  const admin = await db.admin.findUnique({ where: { phone } });
  if (!admin?.active) throw new HttpError(403, "Admin access is disabled");
  if (!testAuth()) await twilio("Verifications", { To: phone, Channel: "sms" });
  const challenge = await db.otpChallenge.create({
    data: { phone, expiresAt: new Date(Date.now() + 5 * 60000) },
  });
  await db.auditLog.create({
    data: { adminId: admin.id, action: "OTP_REQUEST" },
  });
  return { challengeId: challenge.id };
}
export async function verifyOtp(input: unknown) {
  const data = z
    .object({
      challengeId: z.string().uuid(),
      code: z.string().regex(/^\d{6}$/),
    })
    .parse(input);
  const challenge = await db.otpChallenge.findUnique({
    where: { id: data.challengeId },
  });
  if (!challenge || challenge.phone !== process.env.ADMIN_PHONE)
    throw new HttpError(400, "Invalid or expired OTP");
  const claimed = await db.otpChallenge.updateMany({
    where: {
      id: challenge.id,
      used: false,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
    data: { attempts: { increment: 1 } },
  });
  if (!claimed.count) throw new HttpError(400, "Invalid or expired OTP");
  const approved = testAuth()
    ? timingSafeEqual(
        Buffer.from(hash(data.code)),
        Buffer.from(hash(process.env.TEST_OTP!)),
      )
    : (
        await twilio("VerificationCheck", {
          To: challenge.phone,
          Code: data.code,
        })
      ).status === "approved";
  if (!approved) {
    await db.auditLog.create({
      data: { action: "OTP_FAILED", entityId: challenge.id },
    });
    throw new HttpError(400, "Invalid or expired OTP");
  }
  return transaction(async (tx) => {
    const used = await tx.otpChallenge.updateMany({
      where: { id: challenge.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    });
    if (!used.count)
      throw new HttpError(400, "This OTP was already used or expired");
    const admin = await tx.admin.findUniqueOrThrow({
      where: { phone: challenge.phone, active: true },
    });
    // Consume other outstanding challenges for this phone after successful verification.
    await tx.otpChallenge.updateMany({
      where: { phone: challenge.phone, used: false },
      data: { used: true },
    });
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
