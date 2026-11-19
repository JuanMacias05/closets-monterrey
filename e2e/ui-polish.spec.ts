import { expect, test, type Page } from "@playwright/test";

// UI polish phase: phone field, panel groups by role, header overflow, catalog above the fold
// and the gallery thumbnails. Test OTP numbers come from supabase/config.toml.
const ADMIN_PHONE = "8100000004";
const SELLER_PHONE = "8100000001"; // Closet de Renata, approved seller

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("the phone field keeps +52 fixed, formats 10 digits and ignores extra ones", async ({ page }) => {
  await page.goto("/login");
  const field = page.getByLabel("Número de celular");
  await field.fill("81234567899999");
  await expect(field).toHaveValue("81 2345 6789");
  await field.fill("+52 81 2345 6789");
  await expect(field).toHaveValue("81 2345 6789");
  await expect(field).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByRole("link", { name: "Crear cuenta" })).toHaveCount(1);
});

test("after sending a code, resending waits for the cooldown", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(SELLER_PHONE);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByRole("button", { name: /Reenviar en \d+ s/ })).toBeDisabled();
});

test("an admin sees both panel groups and the summary", async ({ page }) => {
  await login(page, ADMIN_PHONE);
  await expect(page.getByRole("heading", { name: "Mi tienda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración del sitio" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Vendedoras por aprobar/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subir prenda" }).first()).toHaveAttribute("href", "/panel/prendas/nueva");
});

// One login covers the seller checks and both header widths: every login sends an SMS, and
// the local stack allows 30 an hour for the whole suite.
test("a seller does not see the admin group, and Cerrar sesión fits at 375 and 1366 px", async ({ page }) => {
  await login(page, SELLER_PHONE);
  await expect(page.getByRole("heading", { name: "Mi tienda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración del sitio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Vendedoras/ })).toHaveCount(0);

  for (const width of [375, 1366]) {
    await page.setViewportSize({ width, height: 800 });
    const button = page.getByRole("banner").getByRole("button", { name: "Cerrar sesión" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }

  // Inner panel pages have a way back: a garment goes back to "Mis prendas".
  await page.goto("/panel/prendas/nueva");
  await page.getByRole("link", { name: "Volver a Mis prendas" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas$/);
  await page.getByRole("link", { name: "Volver a Panel" }).click();
  await expect(page).toHaveURL(/\/panel$/);
});

test("on a 1366×768 laptop the first garment shows without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const firstCard = page.getByTestId("product-grid").locator("article").first();
  await expect(firstCard).toBeInViewport();
  await expect(page.getByRole("link", { name: "Todo", exact: true })).toHaveCount(0);
});

test("a garment with two photos shows two thumbnails", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/prendas/top-satin-marfil");
  const thumbnails = page.getByLabel("Elegir foto").getByRole("button");
  await expect(thumbnails).toHaveCount(2);
  await expect(thumbnails.nth(1)).toBeInViewport();
  const stage = await page.getByTestId("product-gallery-stage").boundingBox();
  expect(stage!.width).toBeGreaterThan(200);
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(768);
});
