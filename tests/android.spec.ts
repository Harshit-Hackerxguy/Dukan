import { devices, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ ...devices["Pixel 7"] });

for (const viewport of [
  { width: 320, height: 640 },
  { width: 360, height: 800 },
  { width: 393, height: 851 },
  { width: 412, height: 915 },
  { width: 915, height: 412 },
]) {
  test(`Android layout stays within the screen at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const route of [
      "/",
      "/admin",
      "/admin/products",
      "/admin/categories",
      "/admin/orders",
      "/admin/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBeTruthy();
    }
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /width=device-width/,
    );
  });
}

test("Android shoppers can search, adjust quantities, and use the thumb-reachable bag", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await search.tap();
  await search.fill("rice");
  await expect(page.locator(".hero")).toBeHidden();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await search.press("Enter");
  const add = page.getByRole("button", {
    name: "Add Regular Rice to bag",
    exact: true,
  });
  const addBox = await add.boundingBox();
  expect(addBox!.height).toBeGreaterThanOrEqual(44);
  await add.tap();
  const increase = page.getByRole("button", {
    name: "Increase Regular Rice quantity",
    exact: true,
  });
  const increaseBox = await increase.boundingBox();
  expect(increaseBox!.width).toBeGreaterThanOrEqual(44);
  expect(increaseBox!.height).toBeGreaterThanOrEqual(44);
  await increase.tap();
  const bag = page.getByRole("button", {
    name: "View bag, 2 bags, ₹2,000",
    exact: true,
  });
  await expect(bag).toBeVisible();
  await bag.tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹2,000");
  await dialog
    .getByRole("button", {
      name: "Decrease Regular Rice quantity",
      exact: true,
    })
    .tap();
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹1,000");
  const close = dialog.getByRole("button", { name: "Close dialog" });
  const closeBox = await close.boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  await close.tap();
  await expect(
    page.getByRole("button", { name: "View bag, 1 bag, ₹1,000", exact: true }),
  ).toBeVisible();
});

test("Android admin uses readable product cards and a touch-friendly editor", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await expect(page.locator(".product-table-wrap")).toBeHidden();
  await expect(page.locator(".mobile-admin-product")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Edit Regular Rice", exact: true })
    .tap();
  const dialog = page.getByRole("dialog");
  const price = dialog.getByLabel("Price per bag");
  await price.fill("1100");
  expect(
    await price.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  await dialog.getByRole("button", { name: "Save changes" }).tap();
  await expect(
    page.locator(".mobile-admin-product").filter({ hasText: "Regular Rice" }),
  ).toContainText("₹1,100");
  await page
    .getByRole("combobox", { name: "Sort admin products" })
    .selectOption("price-desc");
  await expect(page.locator(".mobile-admin-product").first()).toContainText(
    "White Sugar",
  );
  await page.getByRole("button", { name: "Open admin navigation" }).tap();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Dashboard", exact: true })
    .tap();
  await expect(page.locator("h1")).toHaveText("A good day to grow.");
});

test("Android storefront, bag, and product list pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .tap();
  await page
    .getByRole("button", { name: "View bag, 1 bag, ₹1,000", exact: true })
    .tap();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .tap();
  await page.goto("/admin/products");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
