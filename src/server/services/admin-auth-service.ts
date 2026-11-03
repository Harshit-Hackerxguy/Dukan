import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { UnitOfWork } from "../repositories/interfaces";
import { AppError } from "../errors";
import { adminPhone, mockAuthEnabled } from "../config";
import { otpRequestSchema, otpVerifySchema } from "../validation";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const SESSION_COOKIE = "dukan_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
export interface OtpProvider {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}
export class TwilioVerifyProvider implements OtpProvider {
  private async request(path: string, fields: Record<string, string>) {
    const sid = process.env.TWILIO_ACCOUNT_SID,
      token = process.env.TWILIO_AUTH_TOKEN,
      service = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !token || !service || !/^VA[a-zA-Z0-9]+$/.test(service))
      throw new AppError(
        503,
        "OTP_NOT_CONFIGURED",
        "The OTP provider is not configured.",
      );
    try {
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${service}/${path}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(fields),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) throw new Error("OTP provider rejected request");
      return (await response.json()) as { status?: string };
    } catch {
      throw new AppError(
        503,
        "OTP_PROVIDER_FAILED",
        "The OTP provider is unavailable. Please try again later.",
      );
    }
  }
  async send(phone: string) {
    await this.request("Verifications", { To: phone, Channel: "sms" });
  }
  async verify(phone: string, code: string) {
    return (
      (await this.request("VerificationCheck", { To: phone, Code: code }))
        .status === "approved"
    );
  }
}

export class AdminAuthService {
  constructor(
    private uow: UnitOfWork,
    private provider: OtpProvider = new TwilioVerifyProvider(),
  ) {}
  async rateLimit(key: string, limit: number, windowMs: number) {
    const allowed = await this.uow.transaction((r) =>
      r.auth.consumeRate(hash(key), limit, windowMs),
    );
    if (!allowed)
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Please try again later.",
      );
  }
  async request(
    input: unknown,
    ip: string,
  ): Promise<{
    challengeId: string;
    message: string;
    developmentCode?: string;
  }> {
    const { phone } = otpRequestSchema.parse(input);
    await this.rateLimit(`otp-ip:${ip}`, 10, 15 * 60 * 1000);
    await this.rateLimit(`otp-phone:${phone}`, 4, 15 * 60 * 1000);
    const expected = adminPhone();
    const mock = mockAuthEnabled();
    if (!mock && process.env.ADMIN_OTP_PROVIDER !== "twilio")
      throw new AppError(
        503,
        "OTP_NOT_CONFIGURED",
        "Admin sign-in has not been configured.",
      );
    const id = randomUUID();
    const generic = {
      challengeId: id,
      message: "If this is the authorized admin number, a code has been sent.",
    };
    if (phone !== expected) return generic;
    const code = String(randomInt(100000, 1000000));
    if (!mock) await this.provider.send(phone);
    await this.uow.transaction((r) => {
      for (const c of r.auth.challenges())
        if (c.phone === phone) r.auth.deleteChallenge(c.id);
      r.auth.saveChallenge({
        id,
        phone,
        provider: mock ? "mock" : "twilio",
        hash: mock ? hash(`${id}:${code}`) : undefined,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
      });
    });
    return {
      ...generic,
      ...(mock
        ? {
            developmentCode: code,
            message: "Development OTP only. No SMS was sent.",
          }
        : {}),
    };
  }
  async verify(input: unknown, ip: string) {
    const { challengeId, code } = otpVerifySchema.parse(input);
    await this.rateLimit(`verify:${ip}`, 20, 15 * 60 * 1000);
    const token = randomBytes(32).toString("hex");
    const result = await this.uow.transaction(async (r) => {
      const c = r.auth.challenges().find((c) => c.id === challengeId);
      if (!c || c.attempts >= 5 || c.phone !== adminPhone()) return false;
      c.attempts++;
      r.auth.saveChallenge(c);
      const good =
        c.provider === "mock"
          ? mockAuthEnabled() &&
            !!c.hash &&
            timingSafeEqual(
              Buffer.from(c.hash),
              Buffer.from(hash(`${c.id}:${code}`)),
            )
          : await this.provider.verify(c.phone, code);
      if (!good) return false;
      r.auth.deleteChallenge(c.id);
      r.auth.saveSession({
        phone: c.phone,
        tokenHash: hash(token),
        expiresAt: Date.now() + SESSION_SECONDS * 1000,
      });
      return true;
    });
    if (!result)
      throw new AppError(
        401,
        "INVALID_OTP",
        "The code is invalid or expired. Request a new code after five attempts.",
      );
    return token;
  }
  async authenticate(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Please sign in as the store admin.",
      );
    const session = await this.uow.read((r) =>
      r.auth
        .sessions()
        .find((s) => s.tokenHash === hash(token) && s.phone === adminPhone()),
    );
    if (!session)
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Your session has expired. Please sign in again.",
      );
    return session.phone;
  }
  logout(token: string) {
    return this.uow.transaction((r) => r.auth.deleteSession(hash(token)));
  }
}
