import { expect, test, devices } from "@playwright/test";
test.use({ ...devices["Pixel 7"] });
for (const width of [320, 360, 393, 412])
  test(`touch catalogue and checkout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await expect(page.locator(".product-card")).toHaveCount(6);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
    const add = page.getByRole("button", {
      name: "Add Regular Rice to bag",
      exact: true,
    });
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await add.tap();
    await page.getByRole("button", { name: /View bag, 1 bag/ }).tap();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Submit Order", exact: true })
      .tap();
    await expect(page.getByLabel("Customer name")).toBeVisible();
    await expect(page.getByLabel("Mobile number")).toBeVisible();
    await page.getByLabel("Customer name").fill("Mobile Test");
    await page.getByLabel("Mobile number").fill("9876543214");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Submit Order", exact: true }),
    ).toBeEnabled();
  });
