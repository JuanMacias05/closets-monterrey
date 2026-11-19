import { expect, test, type Page } from "@playwright/test";

// Not used by any seeded account; reserved in supabase/config.toml [auth.sms.test_otp].
const NEW_SELLER_PHONE = "+528100000009";
const ADMIN_PHONE = "+528100000004";

async function deleteAccountByPhone(phone: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Run through `npm run test:e2e` so the local Supabase keys are set.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const response = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers });
  const { users } = (await response.json()) as { users: { id: string; phone?: string }[] };
  const existing = users.find((user) => user.phone === phone.replace("+", ""));
  if (existing) await fetch(`${url}/auth/v1/admin/users/${existing.id}`, { method: "DELETE", headers });
}

async function enterCode(page: Page) {
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}

// Long flows across two browsers; the dev server compiles each new page on first visit.
test.setTimeout(120_000);

test.beforeAll(async () => {
  await deleteAccountByPhone(NEW_SELLER_PHONE);
});

test("a new seller signs up, waits for review, and an admin approves and promotes her", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByRole("navigation", { name: "Tipo de cuenta" }).getByRole("link", { name: "Vender" }).click();
  await page.getByLabel("Nombre de tu clóset").fill("Closet de Prueba Registro");
  await page.getByLabel("Número de celular").fill(NEW_SELLER_PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await enterCode(page);
  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión." })).toBeVisible();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Número de celular").fill(ADMIN_PHONE);
  await admin.getByRole("button", { name: "Enviar código" }).click();
  await enterCode(admin);
  await admin.goto("/panel/admin/vendedoras");

  const row = admin.getByRole("listitem").filter({ hasText: "Closet de Prueba Registro" });
  await expect(row.getByText("En revisión")).toBeVisible();
  await row.getByRole("button", { name: "Aprobar" }).click();
  await expect(row.getByText("Aprobada")).toBeVisible();

  admin.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Hacer admin" }).click();
  await expect(row.getByText("Admin", { exact: true })).toBeVisible();

  // The admin's own row never offers self-suspension or self-demotion.
  const ownRow = admin.getByRole("listitem").filter({ hasText: "(tú)" });
  await expect(ownRow.getByRole("button", { name: "Suspender" })).toHaveCount(0);
  await expect(ownRow.getByRole("button", { name: "Quitar admin" })).toHaveCount(0);
  await adminContext.close();

  await page.reload();
  await expect(page.getByText("Administración", { exact: true })).toBeVisible();
  await page.goto("/panel/admin/vendedoras");
  await expect(page.getByRole("heading", { name: "Vendedoras" })).toBeVisible();
});

test("login refuses a number with no account and points to sign-up", async ({ page }) => {
  await deleteAccountByPhone(NEW_SELLER_PHONE);
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(NEW_SELLER_PHONE);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText("Si aún no tienes cuenta, créala primero.")).toBeVisible();
});
