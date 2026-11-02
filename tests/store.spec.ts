import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("catalogue supports search, category filters, sort, and empty results", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".product-card");
  await expect(cards).toHaveCount(6);
  const search = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await search.fill("चीनी");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("White Sugar");
  await search.fill("not-a-grocery");
  await expect(cards).toHaveCount(0);
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
  await page
    .getByRole("combobox", { name: "Sort products" })
    .selectOption("name");
  await expect(cards.first()).toContainText("Everyday Rice");
});

test("bag quantities, total, persistence, and removal work", async ({
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
  await page
    .getByRole("button", { name: "Open bag, 3 items", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹4,000");
  await dialog
    .getByRole("button", {
      name: "Decrease Regular Rice quantity",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹3,000");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open bag, 2 items", exact: true })
    .click();
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹3,000");
  await dialog
    .getByRole("button", { name: "Remove White Sugar from bag" })
    .click();
  await expect(dialog.locator(".summary-line strong")).toHaveText("₹1,000");
  await dialog
    .getByRole("button", { name: "Remove Regular Rice from bag" })
    .click();
  await expect(
    dialog.getByText("Your bag is feeling a little light."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /checkout|pay|place order/i }),
  ).toHaveCount(0);
});

test("product details open and close with keyboard focus contained", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "View Regular Rice details",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Regular Rice", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("50 kg / bag");
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("admin can add, edit, change availability, and delete a product", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Product name", { exact: false })
    .fill("Demo Lentils");
  await dialog.getByLabel("Hindi name").fill("दाल");
  await dialog
    .getByLabel("Category", { exact: false })
    .selectOption("essentials");
  await dialog.getByLabel("Pack weight").fill("25");
  await dialog.getByLabel("Price per bag").fill("1800");
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search admin products" })
    .fill("Demo Lentils");
  const row = page.getByRole("row").filter({ hasText: "Demo Lentils" });
  await expect(row).toContainText("₹1,800");
  await row
    .getByRole("button", { name: "Edit Demo Lentils", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Price per bag").fill("1900");
  await dialog.getByRole("switch").uncheck();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(row).toContainText("₹1,900");
  await expect(row).toContainText("Unavailable");
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("Demo Lentils");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText("Unavailable");
  await expect(
    page
      .locator(".product-card")
      .getByRole("button", { name: /Add .* to bag/ }),
  ).toHaveCount(0);
  await page.goto("/admin/products");
  await page
    .getByRole("textbox", { name: "Search admin products" })
    .fill("Demo Lentils");
  await page
    .getByRole("button", { name: "Delete Demo Lentils", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep product" })
    .click();
  await expect(row).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Demo Lentils", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(page.getByText("Nothing on this shelf just yet.")).toBeVisible();
});

test("availability edits remove ineligible bag items and counts stay honest", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page.goto("/admin/products");
  await page
    .getByRole("button", { name: "Edit Regular Rice", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("switch").uncheck();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await page.goto("/admin");
  await expect(
    page.locator(".metric-card").nth(2).locator(":scope > strong"),
  ).toHaveText("05");
  await expect(
    page.locator(".metric-card").nth(3).locator(":scope > strong"),
  ).toHaveText("01");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open bag, 0 items", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your bag is feeling a little light.",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: "In stock only" }).check();
  await expect(page.locator(".product-card")).toHaveCount(5);
});

test("category links filter admin products and reset restores original catalogue", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  await page
    .locator(".admin-category-card")
    .filter({ hasText: "Fresh produce" })
    .getByRole("link", { name: "Explore products" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Filter admin products by category" }),
  ).toHaveValue("produce");
  await expect(page.locator(".product-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete Fresh Potatoes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await page.goto("/admin/products");
  await expect(page.locator(".product-table tbody tr")).toHaveCount(6);
});

test("invalid product photos fall back to the illustration", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await page
    .getByRole("button", { name: "Edit Regular Rice", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Or use an image URL")
    .fill("http://127.0.0.1:3000/missing-product-photo.jpg");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await page.goto("/");
  const visual = page.getByRole("button", {
    name: "View Regular Rice details",
    exact: true,
  });
  await expect(visual.locator(".product-art")).toHaveJSProperty(
    "tagName",
    "svg",
  );
});

test("bad saved data does not break the storefront", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("dukan-phase1-v1", "invalid-json"),
  );
  await page.goto("/");
  await expect(page.locator(".product-card")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("dialog").locator(".summary-line strong"),
  ).toHaveText("₹1,000");
});

test("the bag remains usable when browser storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".summary-line strong"),
  ).toHaveText("₹1,000");
  await expect(
    page.getByRole("dialog").locator(".storage-notice"),
  ).toContainText("this visit only");
});

test("larger local catalogues support incremental loading and admin pagination", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("dukan-phase1-v1")!);
    const sample = data.products[0];
    data.products = Array.from({ length: 25 }, (_, i) => ({
      ...sample,
      id: `large-catalogue-${i}`,
      name: `Demo Rice ${i + 1}`,
      badge: undefined,
    }));
    data.cart = {};
    localStorage.setItem("dukan-phase1-v1", JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Show more products" }).click();
  await expect(page.locator(".product-card")).toHaveCount(24);
  await page.goto("/admin/products");
  await expect(page.locator(".product-table tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Next product page" }).click();
  await expect(page.getByText("Page 2 of 4")).toBeVisible();
  await expect(page.locator(".product-table tbody tr").first()).toContainText(
    "Demo Rice 9",
  );
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
]) {
  test(`all pages render without horizontal overflow or runtime errors at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of [
      "/",
      "/admin",
      "/admin/products",
      "/admin/categories",
      "/admin/orders",
      "/admin/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}

test("mobile navigation and bag are usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Fresh produce" })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add Fresh Potatoes to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".summary-line strong"),
  ).toHaveText("₹900");
  await page.keyboard.press("Escape");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open admin navigation" }).click();
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Your products.");
});

test("pages and dialogs pass automated WCAG AA checks", async ({ page }) => {
  for (const route of [
    "/",
    "/admin",
    "/admin/products",
    "/admin/categories",
    "/admin/orders",
    "/admin/settings",
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, `Accessibility on ${route}`).toEqual([]);
  }
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Regular Rice to bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bag, 1 item", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
