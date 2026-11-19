import { expect, test } from "@playwright/test";

test("renders the catalog and its product cards", async ({ page }) => {
  await page.goto("/?ver=todo");

  await expect(page.getByRole("heading", { name: "Todo el catálogo" })).toBeVisible();
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

// CATALOG_DEMO_NOW (playwright.config.ts) pins today to 2026-11-24: 13 of the 19 demo garments
// were published in the last 14 days.
test("the home page shows only new arrivals, with a link to everything", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nuevo en tienda" })).toBeVisible();
  await expect(page.getByTestId("product-grid").locator("article")).toHaveCount(13);
  await page.getByRole("link", { name: "Ver todo el catálogo" }).click();
  await expect(page).toHaveURL(/ver=todo/);
  await expect(page.getByTestId("product-grid").locator("article")).toHaveCount(19);
});

test("Mujer and Hombre in the top menu go straight to the whole section", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const categories = page.getByRole("navigation", { name: "Categorías" });
  await categories.getByRole("link", { name: "Hombre" }).click();
  await expect(page).toHaveURL(/audience=men$/);
  await expect(page.getByRole("heading", { name: "Hombre", level: 1 })).toBeVisible();

  await categories.getByRole("link", { name: "Mujer" }).hover();
  await page.locator("#categories-panel").getByRole("link", { name: "Vestidos" }).click();
  await expect(page).toHaveURL(/audience=women&category=dresses/);
});

// The panel hangs below the links with a gap; moving the pointer down through that gap used to
// close it before you could pick a category.
test("the Mujer panel stays open while the pointer moves down into it", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const mujer = page.getByRole("navigation", { name: "Categorías" }).getByRole("link", { name: "Mujer", exact: true });
  await mujer.hover();
  const panel = page.locator("#categories-panel");
  await expect(panel).toBeVisible();
  const link = await mujer.boundingBox();
  const target = await panel.getByRole("link", { name: "Vestidos" }).boundingBox();
  if (!link || !target) throw new Error("menu not laid out");
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 30 });
  await expect(panel).toBeVisible();
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page).toHaveURL(/audience=women&category=dresses/);
});
