import { AppError } from "./errors";

export const isProduction = () => process.env.NODE_ENV === "production";
export function requireDevelopmentStorage() {
  if (isProduction())
    throw new AppError(
      503,
      "DATABASE_REQUIRED",
      "Ordering is unavailable until the permanent database is connected.",
    );
}
export function adminPhone() {
  const phone = process.env.ADMIN_PHONE || "";
  if (!/^\+91[6-9]\d{9}$/.test(phone))
    throw new AppError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Admin sign-in has not been configured.",
    );
  return phone;
}
export function mockAuthEnabled() {
  return (
    !isProduction() &&
    process.env.ADMIN_OTP_PROVIDER === "mock" &&
    process.env.ALLOW_DEV_OTP === "true"
  );
}
export function whatsappConfiguration() {
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const sender = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const template = process.env.WHATSAPP_TEMPLATE_NAME || "";
  return {
    mode: process.env.WHATSAPP_PROVIDER || "disabled",
    version,
    sender,
    template,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
    token: process.env.WHATSAPP_ACCESS_TOKEN || "",
    configured:
      /^v\d+\.0$/.test(version) &&
      /^\d+$/.test(sender) &&
      /^[a-z0-9_]+$/.test(template) &&
      !!process.env.WHATSAPP_ACCESS_TOKEN,
  };
}
