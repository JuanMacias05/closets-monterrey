import { expect, test } from "@playwright/test";

test("opens a product from the catalog and navigates its photo gallery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ver Top satinado marfil" }).click();

  await expect(page).toHaveURL(/\/prendas\/top-satin-marfil$/);
  await expect(page.getByRole("heading", { name: "Top satinado marfil", level: 1 })).toBeVisible();
  await expect(page.getByText("$350.00 MXN").first()).toBeVisible();
  await expect(page.getByText("Closet de Renata").first()).toBeVisible();
  await expect(page.getByText("Busto")).toBeVisible();

  await page.getByRole("button", { name: "Ver foto 2" }).click();
  await expect(page.getByRole("button", { name: "Ampliar foto 2 de 2" })).toBeVisible();
  await page.getByRole("button", { name: "Ampliar foto 2 de 2" }).click();
  await expect(page.getByRole("dialog", { name: "Foto ampliada de Top satinado marfil" })).toBeVisible();
  await page.getByRole("button", { name: "Foto anterior" }).click();
  await expect(page.getByRole("dialog").getByAltText("Top satinado marfil, vista frontal")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar foto ampliada" }).click();
});

test("keeps the purchase button disabled for a sold product", async ({ page }) => {
  await page.goto("/prendas/vestido-satin-champana");

  await expect(page.getByRole("heading", { name: "Vestido satinado champaña", level: 1 })).toBeVisible();
  await expect(page.getByText("Vendida", { exact: true })).toBeVisible();
  await expect(page.getByTestId("buy-button")).toBeDisabled();
});

test("shows the friendly 404 for a missing or non-public product", async ({ page }) => {
  const response = await page.goto("/prendas/no-existe-9999");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta pieza ya no está aquí." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/");
});
