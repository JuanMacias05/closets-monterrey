import { expect, test } from "./fixtures";

test("home loads with the BZRS title and at least one garment", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/BZRS/);
  // An empty catalog in production is not a healthy site, so it fails here.
  await expect(page.getByTestId("product-grid").locator("article").first()).toBeVisible();
});

test("opens a garment's detail page", async ({ page }) => {
  await page.goto("/");
  const firstCard = page.getByTestId("product-grid").locator("article").first();
  const name = (await firstCard.getByRole("heading").innerText()).trim();

  await firstCard.getByRole("link", { name: `Ver ${name}` }).click();

  await expect(page).toHaveURL(/\/prendas\//);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText(/MXN/).first()).toBeVisible();
});
