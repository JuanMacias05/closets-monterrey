import { expect, test } from "@playwright/test";

test("renders the catalog and its product cards", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nuevo en tienda" })).toBeVisible();
  await expect(page.getByTestId("product-grid").locator("article")).toHaveCount(19);
  await expect(page.getByText("Closet de Renata").first()).toBeVisible();
  await expect(page.getByText("$350.00 MXN").first()).toBeVisible();
  await expect(page.getByText("Apartada").first()).toBeVisible();
  await expect(page.getByText("Vendida").first()).toBeVisible();
});

test("updates the shareable URL and results after filtering", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Filtros" }).click();
  const panel = page.getByRole("dialog", { name: "Filtrar prendas" });
  await panel.locator("#filters-category").selectOption("dresses");
  await expect(page).toHaveURL(/category=dresses/);
  await panel.getByRole("checkbox", { name: "Ocultar prendas vendidas" }).check();
  await panel.getByRole("button", { name: "Ver resultados" }).click();
  await expect(panel).toHaveCount(0);

  await expect(page).toHaveURL(/category=dresses/);
  await expect(page).toHaveURL(/hideSold=1/);
  await expect(page.getByTestId("product-grid").locator("article")).toHaveCount(1);
  await expect(page.getByText("Vestido floral de verano")).toBeVisible();
  await expect(page.getByText("Vestido satinado champaña")).toHaveCount(0);
});

test("opens the mobile filter drawer and keeps a two-column catalog grid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect.poll(async () => {
    const columns = await page.getByTestId("product-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    return columns;
  }).toBe(2);

  await page.getByRole("button", { name: "Filtros" }).click();
  await expect(page.getByRole("dialog", { name: "Filtrar prendas" })).toBeVisible();
  await page.locator("#filters-category").selectOption("shoes");
  await page.getByRole("button", { name: "Ver resultados" }).click();

  await expect(page).toHaveURL(/category=shoes/);
  await expect(page.getByTestId("product-grid").locator("article")).toHaveCount(3);
  await expect(page.getByText("Tenis blancos minimal")).toBeVisible();

  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(async () => page.getByTestId("product-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length,
  )).toBe(3);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => page.getByTestId("product-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length,
  )).toBe(4);
});
