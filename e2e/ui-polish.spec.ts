import { expect, test, type Page } from "@playwright/test";

// UI polish phase: phone field, panel groups by role, header overflow, catalog above the fold
// and the gallery thumbnails. Test OTP numbers come from supabase/config.toml.
const ADMIN_PHONE = "8100000004";
const SELLER_PHONE = "8100000001"; // Closet de Renata, approved seller

const ADMIN_ID = "10000000-0000-4000-8000-000000000004";

async function setAdminStoreName(name: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");

  const response = await fetch(`${url}/rest/v1/profiles?id=eq.${ADMIN_ID}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ store_name: name }),
  });
  if (!response.ok) throw new Error(`Could not set the local admin fixture name (${response.status}).`);
}

test.beforeAll(async () => { await setAdminStoreName("Admin de prueba"); });

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

test("an admin opens the panel from the green bar and can view the store as a buyer", async ({ page }) => {
  await login(page, ADMIN_PHONE);
  // (Also the admin login check that used to live in auth.spec: one login less for the SMS cap.)
  await expect(page.getByRole("heading", { name: "Admin de prueba" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi tienda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración del sitio" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Vendedoras por aprobar/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subir prenda" }).first()).toHaveAttribute("href", "/panel/prendas/nueva");

  // The panel keeps the store's look: store nav and banner, PANEL ▾ in the green bar.
  await expect(page.getByRole("navigation", { name: "Categorías" })).toBeVisible();
  await page.getByRole("button", { name: /^Panel · Inicio/ }).click();
  const menu = page.getByRole("group", { name: "Panel" });
  await expect(menu.getByText("Tu clóset", { exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/panel/admin/soporte");
  await expect(menu.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

  // "Ver como clienta": no green bar, buyer menu, an amber strip to come back.
  await menu.getByRole("button", { name: "Ver como clienta" }).click();
  await expect(page.getByText("Estás viendo la tienda como una clienta.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Panel/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Mi cuenta/ }).click();
  await expect(page.getByRole("group", { name: "Mi cuenta" }).getByRole("link", { name: "Quiero vender" })).toBeVisible();
  await page.getByRole("button", { name: "Volver a admin" }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Panel · Inicio/ })).toBeVisible();
});

// One login covers the seller's menu at laptop and phone widths: every login sends an SMS, and
// the local stack allows 30 an hour for the whole suite.
test("a seller's PANEL menu says where she is and opens as a sheet on a phone", async ({ page }) => {
  await login(page, SELLER_PHONE);
  await expect(page.getByRole("heading", { name: "Mi tienda", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración del sitio" })).toHaveCount(0);

  // Laptop: hovering PANEL opens one column, hers.
  await page.setViewportSize({ width: 1366, height: 800 });
  const button = page.getByRole("button", { name: /^Panel/ });
  await expect(button).toHaveText(/Panel · Inicio/);
  await button.hover();
  const menu = page.getByRole("group", { name: "Panel" });
  await expect(menu.getByText("Tu clóset", { exact: true })).toBeVisible();
  await expect(menu.getByText("Administración del sitio")).toHaveCount(0);
  await expect(menu.getByText("Próximamente")).toBeVisible();
  await expect(menu.getByRole("link", { name: /Mensajes/ })).toHaveCount(0);
  await menu.getByRole("link", { name: "Apartados" }).click();
  await expect(page).toHaveURL(/\/panel\/apartados$/);
  await expect(button).toHaveText(/Panel · Apartados/);
  // No "Volver a Panel" anywhere: the menu does that job.
  await expect(page.getByRole("link", { name: /Volver a/ })).toHaveCount(0);

  // Phone: PANEL opens a bottom sheet, and nothing scrolls sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  await button.click();
  const sheet = page.getByRole("dialog", { name: "Panel" });
  await expect(sheet.getByRole("link", { name: "Mis prendas" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await sheet.getByRole("link", { name: "Mis prendas" }).click();
  await expect(page).toHaveURL(/\/panel\/prendas$/);
  await expect(sheet).toHaveCount(0);

  // A garment sits inside Mis prendas, so editing one keeps its way back.
  await page.goto("/panel/prendas/nueva");
  await expect(page.getByRole("link", { name: /Volver a Mis prendas/ })).toHaveCount(0);
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
