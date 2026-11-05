import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function createOrder(request: APIRequestContext, page: Page) {
  const name = `Manual share ${randomUUID()}`;
  const response = await request.post("/api/checkout", {
    headers: {
      Origin: "http://127.0.0.1:3000",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name,
      phone: "9876543216",
      items: [
        { variantId: "regular-rice", quantity: 1, expectedPricePaise: 100000 },
      ],
    },
  });
  expect(response.status()).toBe(201);
  expect((await response.json()).whatsappStatus).toBe("not_configured");
  const [order] = await (
    await request.get(`/api/admin/orders?search=${encodeURIComponent(name)}`)
  ).json();
  await page.goto("/admin/orders");
  await page.getByRole("textbox", { name: "Search orders" }).fill(name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const panel = page.locator("article").filter({ hasText: order.memo.number });
  await expect(panel).toBeVisible();
  return { order, panel };
}

test("share downloads the original bill before opening the correct customer's chat", async ({
  request,
  page,
  context,
}) => {
  const { order, panel } = await createOrder(request, page);
  expect(order.whatsappShareUrl).toBe("https://wa.me/919876543216");
  const pdf = await (
    await request.get(`/api/admin/memos/${order.memo.id}`)
  ).body();
  const events: string[] = [];
  page.on("download", () => events.push("download"));
  await context.route("https://wa.me/**", async (route) => {
    events.push("chat");
    await route.fulfill({
      contentType: "text/html",
      body: "Customer chat test stub",
    });
  });
  const downloadPromise = page.waitForEvent("download");
  const popupPromise = page.waitForEvent("popup");
  await panel
    .getByRole("button", { name: "Share on whatsapp", exact: true })
    .click();
  const download = await downloadPromise;
  const popup = await popupPromise;
  await expect(popup).toHaveURL(order.whatsappShareUrl);
  expect(download.suggestedFilename()).toBe(`${order.memo.number}.pdf`);
  expect(await readFile((await download.path())!)).toEqual(pdf);
  expect(events).toEqual(["download", "chat"]);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await expect(panel.getByRole("status")).toContainText("send it manually");
  await expect(panel.getByText("Retry WhatsApp")).toHaveCount(0);
  await expect(
    panel.getByText("Delivery attempts", { exact: false }),
  ).toHaveCount(0);
  const directDownload = page.waitForEvent("download");
  await panel.getByRole("link", { name: "Download memo" }).click();
  expect(await readFile((await (await directDownload).path())!)).toEqual(pdf);
  await popup.close();
  expect(
    (
      await request.post(`/api/admin/memos/${order.memo.id}/retry`, {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: {},
      })
    ).status(),
  ).toBe(404);
  expect((await request.get("/api/webhooks/whatsapp")).status()).toBe(404);
});

test("a failed PDF download closes the blank tab and never opens WhatsApp", async ({
  request,
  page,
  context,
}) => {
  const { order, panel } = await createOrder(request, page);
  const chats: string[] = [];
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await context.route("https://wa.me/**", async (route) => {
    chats.push(route.request().url());
    await route.abort();
  });
  await page.route(`**/api/admin/memos/${order.memo.id}?download=1`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"error":"Failed"}',
    }),
  );
  const popupPromise = page.waitForEvent("popup");
  await panel
    .getByRole("button", { name: "Share on whatsapp", exact: true })
    .click();
  const popup = await popupPromise;
  await expect(panel.getByRole("alert")).toContainText(
    "Could not download the bill",
  );
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(chats).toEqual([]);
  expect(downloads).toEqual([]);
  await expect(
    panel.getByRole("button", { name: "Share on whatsapp", exact: true }),
  ).toBeEnabled();
  await expect(
    panel.getByRole("link", { name: "Open customer’s WhatsApp" }),
  ).toHaveCount(0);
});

test("blocked popups still download the bill and provide a working customer chat link", async ({
  request,
  page,
  context,
}) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  const { order, panel } = await createOrder(request, page);
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "Customer chat test stub",
    }),
  );
  const downloadPromise = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Share on whatsapp", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    `${order.memo.number}.pdf`,
  );
  const link = panel.getByRole("link", { name: "Open customer’s WhatsApp" });
  await expect(link).toHaveAttribute("href", "https://wa.me/919876543216");
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(order.whatsappShareUrl);
  await popup.close();
});

test("settings save without WhatsApp recipient or extra OTP", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Store name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("WhatsApp recipient")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Settings saved" }),
  ).toBeVisible();
});
