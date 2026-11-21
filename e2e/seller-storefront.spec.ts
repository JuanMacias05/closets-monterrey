import { expect, test } from "@playwright/test";

// Renata (seed) reaches Estación Padre Mier and Estación Cuauhtémoc and delivers home from
// Monterrey, priced by the zone rates (seeded placeholders: $60 same municipality, $100 other).
test("a garment shows where its seller delivers and links to her storefront", async ({ page }) => {
  await page.goto("/prendas/top-satin-marfil");
  const delivery = page.getByRole("region", { name: "Entrega" });
  await expect(delivery.getByText("Estación Padre Mier")).toBeVisible();
  await expect(delivery.getByText("Estación Cuauhtémoc")).toBeVisible();
  await expect(delivery.getByText("A domicilio desde Monterrey: $60.00 MXN a $100.00 MXN según tu municipio")).toBeVisible();

  await page.getByRole("link", { name: /Vendido por.*Closet de Renata/ }).click();
  // First visit compiles the page on the dev server; give it more than the default 5 s.
  await expect(page).toHaveURL(/\/tiendas\/closet-de-renata$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Closet de Renata", level: 1 })).toBeVisible();
  await expect(page.getByText("Estación Padre Mier")).toBeVisible();
  await expect(page.getByTestId("seller-product-grid").locator("article").first()).toBeVisible();
  await expect(page.getByTestId("seller-product-grid").getByText("Top satinado marfil")).toBeVisible();
});

test("a seller without delivery set up says it's arranged on WhatsApp", async ({ page }) => {
  await page.goto("/tiendas/el-closet-de-sofia");
  await expect(page.getByRole("heading", { name: "El clóset de Sofía", level: 1 })).toBeVisible();
  await expect(page.getByText("La entrega se acuerda por WhatsApp al apartar.")).toBeVisible();
});

test("an unknown store is a 404", async ({ page }) => {
  const response = await page.goto("/tiendas/no-existe-esta-tienda");
  expect(response?.status()).toBe(404);
});
