import { expect, test } from "@playwright/test";

// Header search against the demo catalog (CATALOG_DEMO_MODE). The store is browsable without
// an account, so none of these log in.

test("search opens under the header, shows live results and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");

  const trigger = page.getByRole("navigation", { name: "Categorías" }).getByRole("button", { name: "Buscar" });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Buscar prendas" });
  const input = panel.getByRole("searchbox", { name: "Buscar prendas" });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("placeholder", "¿Qué estás buscando?");
  await expect(panel.getByRole("heading", { name: "Lo más buscado" })).toBeVisible();

  // Accents and case don't matter.
  await input.fill("PANTALÓN chino");
  const results = panel.getByRole("list", { name: "Resultados" });
  await expect(results.getByRole("link", { name: /Pantalón chino caqui/ })).toBeVisible();
  await expect(results.getByRole("link")).toHaveCount(1);
  await expect(panel.getByRole("heading", { name: "Lo más buscado" })).toHaveCount(0);

  await input.fill("zzzz");
  await expect(panel.getByText("No encontramos prendas con esa búsqueda. Prueba con otra palabra o una talla.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Enter opens the results in the catalog, where filters still apply", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Categorías" }).getByRole("button", { name: "Buscar" }).click();
  const input = page.getByRole("searchbox", { name: "Buscar prendas" });
  await input.fill("vestidos");
  await input.press("Enter");

  await expect(page).toHaveURL(/\/\?q=vestidos$/);
  await expect(page.getByRole("heading", { name: "“vestidos”", level: 1 })).toBeVisible();
  const grid = page.getByTestId("product-grid");
  await expect(grid.locator("article")).toHaveCount(2);

  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByRole("dialog", { name: "Filtrar prendas" }).getByRole("checkbox", { name: "Ocultar prendas vendidas" }).check();
  await expect(page).toHaveURL(/q=vestidos/);
  await expect(page).toHaveURL(/hideSold=1/);
  await expect(grid.locator("article")).toHaveCount(1);
  await expect(grid.getByText("Vestido floral de verano")).toBeVisible();
});

test("on a phone the search is in the header, takes the full width and a result opens the garment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("banner").getByRole("button", { name: "Buscar", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Buscar prendas" });
  await expect(panel).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.width).toBe(390);

  // Which chips show depends on what was searched on this database; any of them fills the box.
  const input = panel.getByRole("searchbox", { name: "Buscar prendas" });
  const chip = panel.getByRole("region", { name: "Lo más buscado" }).getByRole("button").first();
  const chipText = (await chip.textContent()) ?? "";
  await chip.click();
  await expect(input).toHaveValue(chipText);

  await input.fill("tenis");
  const result = panel.getByRole("list", { name: "Resultados" }).getByRole("link", { name: /Tenis blancos minimal/ });
  await result.click();
  await expect(page).toHaveURL(/\/prendas\/tenis-blancos-minimal$/);
  await expect(panel).toHaveCount(0);
});

// The store's motion (card entrances, shimmer, slides) is opt-in under prefers-reduced-motion.
test("cards only animate in when the visitor hasn't asked for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.getByTestId("product-grid").locator("article").first();
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).animationName)).toBe("card-enter");
});
