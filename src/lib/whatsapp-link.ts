import { parsePhoneNumberFromString } from "libphonenumber-js";

// Use the order's phone snapshot, never the store recipient or customer profile.
export function whatsappLink(phone: string): string | null {
  const number = parsePhoneNumberFromString(phone, "IN");
  return number?.isValid() ? `https://wa.me/${number.number.slice(1)}` : null;
}
