import { expect, test } from "@playwright/test";

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
