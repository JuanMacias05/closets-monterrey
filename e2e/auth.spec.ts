import { expect, test, type Page } from "@playwright/test";

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

async function loginWithTestOtp(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(phone);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("redirects a visitor without a session to phone login", async ({ page }) => {
  await page.goto("/panel");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Bienvenida a tu closet." })).toBeVisible();
});

test("allows an approved admin to enter the panel with a local test OTP", async ({ page }) => {
  await setAdminStoreName("Admin de prueba");
  await loginWithTestOtp(page, "+528100000004");

  await expect(page.getByText("Administración", { exact: true })).toBeVisible();
  await expect(page.getByText("Admin de prueba", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi tienda" })).toBeVisible();
});

test("shows the review message for a pending account", async ({ page }) => {
  await loginWithTestOtp(page, "+528100000003");

  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión." })).toBeVisible();
  await expect(page.getByText("Te avisaremos cuando la administración apruebe tu tienda.")).toBeVisible();
});

test("denies panel access to a suspended account", async ({ page }) => {
  await loginWithTestOtp(page, "+528100000005");

  await expect(page.getByRole("heading", { name: "Tu cuenta está suspendida." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});
