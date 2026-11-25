import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByRole("heading", { name: "Entra a BZRS." })).toBeVisible();
});

test("shows the review message for a pending account", async ({ page }) => {
  await loginWithTestOtp(page, "+528100000003");

  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión." })).toBeVisible();
  await expect(page.getByText("Te avisaremos cuando la administración apruebe tu bazar.")).toBeVisible();
});

test("denies panel access to a suspended account", async ({ page }) => {
  await loginWithTestOtp(page, "+528100000005");

  await expect(page.getByRole("heading", { name: "Tu cuenta está suspendida." })).toBeVisible();
  await page.getByRole("button", { name: /Mi cuenta/ }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});
