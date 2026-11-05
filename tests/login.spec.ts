import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3000";
test("customer sign-in gates checkout, preserves the bag, and never grants admin access", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 393, height: 851 },
  });
  const page = await context.newPage();
  expect(
    (
      await context.request.post(`${origin}/api/checkout`, {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  const bag = page.getByRole("button", {
    name: "Open bag, 1 item",
    exact: true,
  });
  const profile = page.getByRole("button", { name: "Profile and sign in" });
  expect((await profile.boundingBox())!.x).toBeGreaterThan(
    (await bag.boundingBox())!.x,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await profile.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Admin login" })).toBeVisible();
  await dialog.getByLabel("Customer name").fill("Customer account");
  await dialog.getByLabel("Mobile number").fill("9973700894");
  await dialog.getByRole("button", { name: "Continue as customer" }).click();
  await expect(dialog.getByText(/Signed in as/)).toBeVisible();
  expect(
    (await context.request.get(`${origin}/api/admin/orders`)).status(),
  ).toBe(401);
  await dialog.getByRole("button", { name: "Sign out as customer" }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await bag.click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Customer sign in" }),
  ).toBeVisible();
  const name = `Signed customer ${randomUUID()}`;
  await dialog.getByLabel("Customer name").fill(name);
  await dialog.getByLabel("Mobile number").fill("9876543218");
  await dialog.getByRole("button", { name: "Continue as customer" }).click();
  await expect(dialog.getByLabel("Customer name")).toHaveValue(name);
  await expect(dialog.getByText("₹1,000", { exact: true })).toBeVisible();
  const result = await context.request.post(`${origin}/api/checkout`, {
    headers: { Origin: origin, "Idempotency-Key": randomUUID() },
    data: {
      name: "Spoofed",
      phone: "+919999999999",
      items: [
        { variantId: "regular-rice", quantity: 1, expectedPricePaise: 100000 },
      ],
    },
  });
  expect(result.status()).toBe(201);
  // Identity changes in a checkout payload cannot replace the signed-in identity.
  const { db } = await import("../src/server/db");
  const order = await db.orderRequest.findUniqueOrThrow({
    where: { id: (await result.json()).orderId },
  });
  expect(order.customerName).toBe(name);
  expect(order.customerPhone).toBe("+919876543218");
  await db.$disconnect();
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await expect(
    dialog.getByText("Order request recorded", { exact: true }),
  ).toBeVisible();
  await context.close();
});
test("second approved admin can sign in and retired OTP routes are unavailable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Mobile number").fill("9308604097");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/admin`);
  expect(
    (
      await context.request.post(`${origin}/api/auth/request`, {
        headers: { Origin: origin },
        data: { phone: "9308604097" },
      })
    ).status(),
  ).toBe(404);
  await context.close();
});
