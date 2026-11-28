import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PAGE_SIZE = 24;

// IMPORTANT: production may hold fewer garments than an order or a second page needs (one, on
// 2026-11-28). Then these cases check that the controls work (URL, no error) and skip the
// comparison; the comparison switches on by itself once there are enough garments.

async function openFilters(page: Page) {
  await page.getByRole("button", { name: "Filtros" }).click();
  return page.getByRole("dialog", { name: "Filtrar prendas" });
}

async function visiblePrices(page: Page): Promise<number[]> {
  const texts = await page.getByTestId("product-grid").locator("article").getByText(/MXN/).allInnerTexts();
  return texts.map((text) => Number(text.replace(/[^0-9.]/g, "")));
}

async function catalogTotal(page: Page): Promise<number> {
  const summary = await page.getByText(/de \d+ prendas/).innerText();
  return Number(summary.match(/de (\d+) prendas/)?.[1]);
}

for (const [sort, direction] of [["price-asc", 1], ["price-desc", -1]] as const) {
  test(`sorts the catalog by ${sort}`, async ({ page }) => {
    await page.goto("/?ver=todo");
    const panel = await openFilters(page);

    await panel.locator("#filters-sort").selectOption(sort);

    await expect(page).toHaveURL(new RegExp(`sort=${sort}`));
    await expect(page.getByTestId("product-grid").locator("article").first()).toBeVisible();
    const prices = await visiblePrices(page);
    if (prices.length >= 2) {
      const sorted = prices.toSorted((left, right) => (left - right) * direction);
      expect(prices).toEqual(sorted);
    }
  });
}

test("paginates the full catalog", async ({ page }) => {
  await page.goto("/?ver=todo");
  const total = await catalogTotal(page);
  const loadMore = page.getByRole("link", { name: `Cargar ${PAGE_SIZE} prendas más` });

  if (total > PAGE_SIZE) {
    const firstPage = await page.getByTestId("product-grid").locator("article h2").allInnerTexts();
    await loadMore.click();
    await expect(page).toHaveURL(/page=2/);
    const secondPage = await page.getByTestId("product-grid").locator("article h2").allInnerTexts();
    expect(secondPage.length).toBeGreaterThan(0);
    expect(secondPage.filter((name) => firstPage.includes(name))).toEqual([]);
  } else {
    await expect(loadMore).toHaveCount(0);
    // A page past the end (an old shared link) lands back on page 1 of the same catalog.
    await page.goto("/?ver=todo&page=2");
    await expect(page).toHaveURL(/\/\?ver=todo$/);
    await expect(page.getByTestId("product-grid").locator("article").first()).toBeVisible();
  }
});

test("filters the catalog by category", async ({ page }) => {
  await page.goto("/?ver=todo");
  const panel = await openFilters(page);
  const category = panel.locator("#filters-category");
  const value = await category.locator("option:not([value=''])").first().getAttribute("value");

  await category.selectOption(value!);

  await expect(page).toHaveURL(new RegExp(`category=${value}`));
  await expect(
    page.getByTestId("product-grid").or(page.getByText("No encontramos prendas con estos filtros.")),
  ).toBeVisible();
});

test("the search results page finds a garment and reports no match", async ({ page }) => {
  await page.goto("/?ver=todo");
  const name = (await page.getByTestId("product-grid").locator("article h2").first().innerText()).trim();
  const word = name.split(/\s+/).find((part) => part.length >= 4) ?? name;

  // Straight to the results URL: submitting the header search POSTs the term to
  // /api/buscar/terminos, a write the guard would block.
  await page.goto(`/?q=${encodeURIComponent(word)}`);
  await expect(page.getByText("Resultados de búsqueda")).toBeVisible();
  await expect(page.getByTestId("product-grid").getByText(name)).toBeVisible();

  await page.goto("/?q=zzqxv");
  await expect(page.getByText("No encontramos prendas con esa búsqueda.")).toBeVisible();
});
