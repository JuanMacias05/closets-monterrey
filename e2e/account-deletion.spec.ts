import { expect, test } from "@playwright/test";

// The account is created and deleted inside the test, so the number is free again afterwards.
const PHONE = "8100000011";

test("a shopper with a clean record deletes her own account", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Compradora Que Se Va");
  await page.getByLabel("Link de tu perfil de Facebook").fill("facebook.com/compradora.se.va");
  await page.getByLabel("Número de celular").fill(PHONE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);

  await page.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await expect(page.getByText("¿Borrar tu cuenta para siempre?")).toBeVisible();
  await page.getByRole("button", { name: "Sí, borrar mi cuenta" }).click();
  await expect(page).toHaveURL(/\/\?cuenta=borrada$/);

  // The number has no account any more: login refuses it and points to sign-up.
  await page.goto("/login");
  await page.getByLabel("Número de celular").fill(PHONE);
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText("No pudimos enviar el código. Si aún no tienes cuenta, créala primero.")).toBeVisible();
});
