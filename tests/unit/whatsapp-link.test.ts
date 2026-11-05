import test from "node:test";
import assert from "node:assert/strict";
import { whatsappLink } from "../../src/lib/whatsapp-link";

test("WhatsApp links normalize Indian customer numbers without duplicating the country code", () => {
  for (const phone of [
    "9876543210",
    "+919876543210",
    "+91 98765 43210",
    "919876543210",
  ])
    assert.equal(whatsappLink(phone), "https://wa.me/919876543210");
});

test("valid international numbers retain their own country code", () => {
  assert.equal(whatsappLink("+44 7911 123456"), "https://wa.me/447911123456");
});

test("missing or invalid historical phone numbers cannot open an unrelated chat", () => {
  for (const phone of ["", "123", "0000000000", "not a number"])
    assert.equal(whatsappLink(phone), null);
});
