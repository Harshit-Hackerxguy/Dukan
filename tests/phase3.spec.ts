import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:3000";
test("public endpoints hide stock and reject access to private records and PDFs", async ({
  browser,
  request,
}) => {
  const catalogue = await (await request.get("/api/catalogue")).json();
  expect(catalogue.products.length).toBe(6);
  expect(JSON.stringify(catalogue)).not.toMatch(
    /"quantity"|"inventory"|"updatedBy"/,
  );
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  for (const path of [
    "inventory",
    "orders",
    "customers",
    "settings",
    "catalogue",
    "memos/not-a-memo",
  ])
    expect(
      (await context.request.get(`${origin}/api/admin/${path}`)).status(),
    ).toBe(401);
  expect(
    (
      await context.request.post(`${origin}/api/admin/inventory`, {
        headers: { Origin: origin },
        data: { updates: [] },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/admin/products", {
        headers: { Origin: "https://attacker.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const page = await context.newPage();
  await page.goto(`${origin}/admin/orders`);
  await expect(page).toHaveURL(/admin-login/);
  await context.close();
});
test("admin creates, prices, stocks, and archives a package through the existing UI", async ({
  page,
  request,
}) => {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = `Browser rice ${Date.now()}`;
  await dialog.getByLabel("Product name").fill(name);
  await dialog.getByLabel("Price per bag").fill("1250");
  await dialog.getByLabel("Category", { exact: false }).selectOption("rice");
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const catalogue = await (await request.get("/api/admin/catalogue")).json();
  const product = catalogue.products.find(
    (p: { name: string }) => p.name === name,
  );
  expect(product).toBeTruthy();
  await page.goto("/admin/inventory");
  await page
    .getByRole("spinbutton", { name: `New stock for ${name}` })
    .fill("4");
  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Stock updated" }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill(name);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-price strong")).toHaveText("₹1,250");
  await page.getByRole("button", { name: `Add ${name} to bag` }).click();
  for (let i = 1; i < 4; i++) {
    await page
      .getByRole("button", { name: `Increase ${name} quantity` })
      .click();
    await expect(page.locator(".quantity-control span")).toHaveText(
      String(i + 1),
    );
  }
  await page.getByRole("button", { name: `Increase ${name} quantity` }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Requested quantity unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".quantity-control span")).toHaveText("4");
  expect(
    (
      await request.delete(`/api/admin/products/${product.id}`, {
        headers: { Origin: origin },
      })
    ).ok(),
  ).toBeTruthy();
});
test("checkout creates private memo and completion keeps inventory unchanged", async ({
  page,
  request,
  browser,
}) => {
  const before = await (await request.get("/api/admin/inventory")).json();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await dialog.getByLabel("Customer name").fill("Browser customer");
  await dialog.getByLabel("Mobile number").fill("9876543215");
  await dialog.getByRole("button", { name: "Continue as customer" }).click();
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await expect(
    dialog.getByText("Order request recorded", { exact: true }),
  ).toBeVisible();
  const orders = await (
    await request.get("/api/admin/orders?search=Browser%20customer")
  ).json();
  const order = orders[0];
  expect(order.items[0].unitPricePaise).toBe(100000);
  expect(order.status).toBe("PENDING");
  const pdf = await request.get(`/api/admin/memos/${order.memo.id}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const anonymous = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  expect(
    (
      await anonymous.request.get(`${origin}/api/admin/memos/${order.memo.id}`)
    ).status(),
  ).toBe(401);
  await anonymous.close();
  expect(
    (
      await request.patch(`/api/admin/orders/${order.id}`, {
        headers: { Origin: origin },
        data: { status: "COMPLETED" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(await (await request.get("/api/admin/inventory")).json()).toEqual(
    before,
  );
  await page.goto("/admin/orders");
  await expect(
    page.getByText(order.memo.number, { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/customers");
  await expect(
    page.getByRole("heading", { name: "Browser customer" }),
  ).toBeVisible();
});
test("admin password login rejects invalid credentials and signs out", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Mobile number").fill("9876543212");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Invalid",
  );
  await page.getByLabel("Mobile number").fill("9973700894");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Invalid",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/admin`);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "dukan_admin",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/admin-login/);
  expect(
    (await context.request.get(`${origin}/api/admin/orders`)).status(),
  ).toBe(401);
  await context.close();
});
test("new admin screens and checkout remain accessible", async ({ page }) => {
  for (const path of [
    "/admin/inventory",
    "/admin/orders",
    "/admin/customers",
    "/admin/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
