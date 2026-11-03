import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { rm, mkdir } from "node:fs/promises";
const origin = "http://127.0.0.1:3100";
let adminState: Awaited<ReturnType<BrowserContext["storageState"]>>;
let admin: APIRequestContext;
const headers = { Origin: origin };

test.beforeAll(async ({ playwright }) => {
  await mkdir("work", { recursive: true });
  await rm("work/browser-test-data.json", { force: true });
  admin = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  const c = await (
    await admin.post("/api/auth/request", { data: { phone: "+919999999999" } })
  ).json();
  expect(c, JSON.stringify(c)).toHaveProperty("developmentCode");
  expect(c.developmentCode).toMatch(/^\d{6}$/);
  expect(
    (
      await admin.post("/api/auth/verify", {
        data: { challengeId: c.challengeId, code: c.developmentCode },
      })
    ).ok(),
  ).toBeTruthy();
  adminState = await admin.storageState();
  const seed = await admin.post("/api/checkout", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      name: "Sample Order Customer",
      phone: "+919876543215",
      items: [{ productId: "regular-rice", quantity: 1 }],
    },
  });
  expect(seed.ok()).toBeTruthy();
});
test.afterAll(async () => {
  await admin.dispose();
});

async function signIn(context: BrowserContext) {
  await context.addCookies(adminState.cookies);
}

test("catalogue search, filters, sort, empty results and compact hero", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".product-card");
  await expect(cards).toHaveCount(6);
  expect(
    (await page.locator(".compact-hero").boundingBox())!.height,
  ).toBeLessThan(220);
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("चीनी");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("White Sugar");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("nothing123");
  await expect(page.getByText("No essentials found just yet.")).toBeVisible();
  await page.getByRole("button", { name: "View all products" }).click();
  await page
    .locator(".category-grid")
    .getByRole("button", { name: "Rice & grains" })
    .click();
  await expect(cards).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Sort products" })
    .selectOption("price-asc");
  await expect(cards.first()).toContainText("Everyday Rice");
  await page
    .getByRole("combobox", { name: "Sort products" })
    .selectOption("price-desc");
  await expect(cards.first()).toContainText("Super Premium Rice");
});

test("bag quantities, unit/line totals, persistence, removal and checkout fields", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Increase Regular Rice quantity",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add White Sugar to bag", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open bag, 3 items", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹4,000");
  await expect(dialog).toContainText("₹1,000 each");
  await dialog
    .getByRole("button", { name: "Remove White Sugar from bag" })
    .click();
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹2,000");
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await expect(dialog.getByLabel("Customer name")).toBeVisible();
  await expect(dialog.getByLabel("Mobile number")).toBeVisible();
  await expect(dialog.locator("input")).toHaveCount(2);
  await expect(dialog).toContainText(
    "Product availability is subject to confirmation by the store.",
  );
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  expect(
    await dialog
      .getByLabel("Customer name")
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);
  await expect(dialog.getByText("Order request recorded")).not.toBeVisible();
});

test("checkout creates a real memo, reports mock delivery accurately, and leaves stock unchanged", async ({
  page,
}) => {
  const before = await (await admin.get("/api/admin/inventory")).json();
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
  await dialog.getByLabel("Customer name").fill("Browser Test Customer");
  await dialog.getByLabel("Mobile number").fill("9876543211");
  await dialog
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await expect(dialog.getByText("Order request recorded")).toBeVisible();
  await expect(dialog).toContainText("no WhatsApp message was sent");
  await expect(dialog).toContainText("₹1,000");
  const after = await (await admin.get("/api/admin/inventory")).json();
  expect(after).toEqual(before);
  const orders = await (await admin.get("/api/admin/orders")).json();
  expect(orders.orders[0].customer.phone).toBe("+919876543211");
  const pdf = await admin.get(`/api/admin/orders/${orders.orders[0].id}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("APIs enforce admin sessions, CSRF, trusted prices, idempotency, and private PDFs", async ({
  request,
}) => {
  const order = (await (await admin.get("/api/admin/orders")).json()).orders[0];
  for (const path of [
    "products",
    "inventory",
    "orders",
    "settings",
    `orders/${order.id}/pdf`,
  ])
    expect((await request.get(`/api/admin/${path}`)).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/inventory", { headers, data: {} })
    ).status(),
  ).toBe(401);
  expect(
    (
      await admin.post("/api/admin/settings", {
        headers: { Origin: "https://other.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const key = crypto.randomUUID();
  const payload = {
    name: "API Test",
    phone: "+919876543212",
    items: [{ productId: "regular-rice", quantity: 2 }],
  };
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      request.post("/api/checkout", {
        headers: { ...headers, "Idempotency-Key": key },
        data: payload,
      }),
    ),
  );
  const bodies = await Promise.all(results.map((r) => r.json()));
  expect(new Set(bodies.map((b) => b.memoNumber)).size).toBe(1);
  expect(bodies[0].totalPaise).toBe(200000);
  expect(
    (
      await request.post("/api/checkout", {
        headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        data: { ...payload, total: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/checkout", {
        headers: { ...headers, "Idempotency-Key": key },
        data: { ...payload, name: "Different" },
      })
    ).status(),
  ).toBe(409);
  const publicData = await (await request.get("/api/catalogue")).json();
  expect(publicData.products[0]).not.toHaveProperty("quantity");
  expect(publicData.products[0]).not.toHaveProperty("stock");
  expect(publicData.store).not.toHaveProperty("whatsappRecipient");
  expect(
    (
      await request.post("/api/webhooks/whatsapp", { data: { entry: [] } })
    ).status(),
  ).toBe(401);
});

test("admin login requires OTP and sets an HttpOnly SameSite session", async ({
  page,
  context,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your store today." }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Send sign-in code" }).click();
  const code = (await page.locator(".dev-code strong").textContent())!;
  await page.getByLabel("One-time code").fill("000000");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.locator(".login-card .form-error")).toContainText(
    "invalid or expired",
  );
  await page.getByLabel("One-time code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Your store today." }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "dukan_admin",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

test("admin can add and edit products, manually stock them, then archive", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Product name", { exact: false })
    .fill("Demo Lentils");
  await dialog.getByLabel("Hindi name").fill("दाल");
  await dialog.getByLabel("Price per bag").fill("1800");
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("Demo Lentils");
  await expect(
    page
      .locator(".product-card")
      .getByText("Out of stock", { exact: true })
      .first(),
  ).toBeVisible();
  await page.goto("/admin/inventory");
  await page
    .getByRole("spinbutton", { name: "Stock for Demo Lentils", exact: true })
    .fill("25");
  await page.getByLabel("Reason for adjustment").fill("Initial physical count");
  await page.getByRole("button", { name: "Save stock adjustments" }).click();
  await expect(
    page.getByText("Initial physical count", { exact: false }),
  ).toBeVisible();
  await page.goto("/admin/products");
  await page
    .getByRole("button", { name: "Edit Demo Lentils", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Price per bag").fill("1900");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("Demo Lentils");
  await expect(page.locator(".product-card")).toContainText("₹1,900");
  await expect(
    page.getByRole("button", { name: "Add Demo Lentils to bag", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/products");
  await page
    .getByRole("button", { name: "Delete Demo Lentils", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("stock shortage, zero stock, and order status updates preserve inventory rules", async ({
  request,
}) => {
  const inventory = await (await admin.get("/api/admin/inventory")).json();
  const rice = inventory.products.find(
    (p: { id: string }) => p.id === "regular-rice",
  );
  expect(
    (
      await admin.post("/api/admin/inventory", {
        data: {
          reason: "Shortage test",
          changes: [
            {
              productId: rice.id,
              quantity: 1,
              expectedQuantity: rice.quantity,
            },
          ],
        },
      })
    ).ok(),
  ).toBeTruthy();
  const response = await request.post("/api/checkout", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      name: "Stock test",
      phone: "+919876543213",
      items: [{ productId: rice.id, quantity: 2 }],
    },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toBe("Requested quantity unavailable.");
  const order = (await (await admin.get("/api/admin/orders")).json()).orders[0];
  for (const status of ["confirmed", "completed", "cancelled"])
    expect(
      (
        await admin.post(`/api/admin/orders/${order.id}/status`, {
          data: { status },
        })
      ).ok(),
    ).toBeTruthy();
  const after = await (await admin.get("/api/admin/inventory")).json();
  expect(
    after.products.find((p: { id: string }) => p.id === rice.id).quantity,
  ).toBe(1);
  await admin.post("/api/admin/inventory", {
    data: {
      reason: "Restore test count",
      changes: [
        { productId: rice.id, quantity: rice.quantity, expectedQuantity: 1 },
      ],
    },
  });
});

test("categories, settings, order actions, and PDF downloads work", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByLabel("Category name").fill("Pulses");
  await page.getByLabel("Description", { exact: true }).fill("Wholesale dals");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page.getByRole("heading", { name: "Pulses" })).toBeVisible();
  await page.goto("/admin/settings");
  await page
    .getByLabel("Store contact information")
    .fill("Contact details for testing");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Store settings saved" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Store contact information")).toHaveValue(
    "Contact details for testing",
  );
  await page.getByLabel("Store contact information").fill("");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.goto("/admin/orders");
  await expect(page.locator(".order-card").first()).toBeVisible();
  await expect(page.locator(".whatsapp-status").first()).toContainText(
    "Mock only",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download memo" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^CM-\d+\.pdf$/);
  await expect(
    page.getByRole("button", { name: "Share PDF manually" }).first(),
  ).toBeVisible();
});

test("details keyboard focus, storage failure, catalogue loading and errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "QuotaExceededError");
    };
  });
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "View Regular Rice details",
    exact: true,
  });
  await trigger.click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".storage-notice"),
  ).toContainText("this visit only");
  await page.keyboard.press("Escape");
  await page.route("**/api/catalogue", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Catalogue temporarily unavailable." }),
    }),
  );
  await page.reload();
  await expect(page.locator(".empty-results[role=alert]")).toContainText(
    "Catalogue temporarily unavailable",
  );
  await page.unroute("**/api/catalogue");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".product-card")).toHaveCount(6);
});

for (const width of [390, 768, 1440])
  test(`responsive pages and accessibility at ${width}px`, async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of [
      "/",
      "/admin",
      "/admin/products",
      "/admin/inventory",
      "/admin/categories",
      "/admin/orders",
      "/admin/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Loading store data…", { exact: true }),
      ).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBeTruthy();
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(a11y.violations, `${path} accessibility`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

test("desktop and mobile review screenshots", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(6);
  await page.screenshot({
    path: "work/storefront-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "work/storefront-mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page.getByRole("button", { name: /View bag, 1 bag/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit Order", exact: true })
    .click();
  await page.screenshot({ path: "work/checkout-mobile.png" });
  const checks = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(checks.violations).toEqual([]);
  await signIn(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/orders");
  await expect(page.locator(".order-card").first()).toBeVisible();
  await page.screenshot({ path: "work/orders-desktop.png", fullPage: true });
});

test("webhook endpoint verifies challenges and authenticates signed bodies", async ({
  request,
}) => {
  const verified = await request.get(
    "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-webhook-verify-token&hub.challenge=challenge123",
  );
  expect(verified.status()).toBe(200);
  expect(await verified.text()).toBe("challenge123");
  expect(
    (
      await request.get(
        "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong",
      )
    ).status(),
  ).toBe(403);
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [],
  });
  const signature = `sha256=${createHmac("sha256", "test-webhook-signing-secret").update(raw).digest("hex")}`;
  const signed = await request.post("/api/webhooks/whatsapp", {
    data: raw,
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
  });
  expect(signed.status()).toBe(200);
  expect(await signed.json()).toEqual({ received: true });
  expect(
    (
      await request.post("/api/webhooks/whatsapp", {
        data: raw + " ",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signature,
        },
      })
    ).status(),
  ).toBe(401);
});
