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
  // Site administration is in the admin's side menu too.
  await expect(page.getByRole("complementary", { name: "Menú del panel" }).getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/panel/admin/soporte");
});

// One login covers the seller checks, the side menu at laptop and phone widths and the way
// back from inner pages: every login sends an SMS, and the local stack allows 30 an hour for
// the whole suite.
test("a seller gets her own side menu: lit on the current page, collapsible, a drawer on a phone", async ({ page }) => {
  await login(page, SELLER_PHONE);
  await expect(page.getByRole("heading", { name: "Mi tienda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración del sitio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Vendedoras/ })).toHaveCount(0);

  // Laptop: a fixed side menu; the top bar keeps only the store and "Ver tienda".
  await page.setViewportSize({ width: 1366, height: 800 });
  const menu = page.getByRole("complementary", { name: "Menú del panel" });
  const nav = menu.getByRole("navigation", { name: "Panel" });
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByText("Próximamente")).toBeVisible();
  await expect(nav.getByRole("link", { name: /En vivo/ })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Ver tienda" })).toHaveAttribute("href", /^\/tiendas\/[a-z0-9-]+$/);

  await nav.getByRole("link", { name: "Apartados" }).click();
  await expect(page).toHaveURL(/\/panel\/apartados$/);
  await expect(nav.getByRole("link", { name: "Apartados" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");

  // Collapsed to icons, and still collapsed after a reload (remembered on this device).
  await menu.getByRole("button", { name: "Contraer menú" }).click();
  await expect.poll(async () => (await menu.boundingBox())?.width ?? 0).toBeLessThan(100);
  await page.reload();
  await expect(menu.getByRole("button", { name: "Expandir menú" })).toBeVisible();
  await menu.getByRole("button", { name: "Expandir menú" }).click();
  await expect(menu.getByRole("button", { name: "Contraer menú" })).toBeVisible();

  // Phone: the menu is a drawer behind the top bar's button, and nothing is pushed off screen.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(menu).toBeHidden();
  const storeLink = page.getByRole("banner").getByRole("link", { name: "Ver tienda" });
  const storeBox = await storeLink.boundingBox();
  expect(storeBox).not.toBeNull();
  expect(storeBox!.x + storeBox!.width).toBeLessThanOrEqual(375);

  await page.getByRole("button", { name: "Abrir menú del panel" }).click();
  const drawer = page.getByRole("dialog", { name: "Menú del panel" });
  const signOut = drawer.getByRole("button", { name: "Cerrar sesión" });
  await expect(signOut).toBeVisible();
  const signOutBox = await signOut.boundingBox();
  expect(signOutBox!.x + signOutBox!.width).toBeLessThanOrEqual(375);
  await drawer.getByRole("link", { name: "Mis prendas" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas$/);
  await expect(drawer).toHaveCount(0);

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
